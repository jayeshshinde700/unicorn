/* Unicorn Hospitality - Admin Studio (rooms dashboard).
   One page, several screens, drawn here. All data goes through api.php (needs your sign-in + a security token). */
(function () {
  "use strict";
  var $ = function (s, c) {
    return (c || document).querySelector(s);
  };
  var $$ = function (s, c) {
    return Array.prototype.slice.call((c || document).querySelectorAll(s));
  };
  var view = $("#view"),
    topActions = $("#topActions"),
    pageTitle = $("#pageTitle"),
    crumb = $("#crumb");
  var reduce =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var S = {
    csrf: ($("meta[name=csrf]") || {}).content || "",
    user: null,
    rooms: [],
    activity: [],
    api: "",
    site: "",
    saved: true,
    list: { q: "", filter: "all", sort: "order" },
    edit: null,
    cur: "",
    reverting: false,
    minPassword: 10,
    idle: 1800,
  };

  var AMENITY = {
    wifi: "Free Wi-Fi",
    snow: "Air-conditioning",
    tv: "Flat-screen TV",
    cup: "Tea & coffee maker",
    lock: "In-room safe",
    bed: "Extra bed available",
    bath: "En-suite bathroom",
    desk: "Work desk",
    sofa: "Sitting area",
    drop: "Rain shower",
    sun: "Great view",
    car: "Free parking",
    pool: "Pool access",
    shield: "24-hour security",
    plane: "Airport transfer",
    gym: "Fitness centre",
  };
  var AM_NAME = {
    wifi: "Wi-Fi",
    snow: "Air-con",
    tv: "TV",
    cup: "Tea & coffee",
    lock: "Safe",
    bed: "Bed",
    bath: "Bathroom",
    desk: "Desk",
    sofa: "Sofa",
    drop: "Shower",
    sun: "View",
    car: "Parking",
    pool: "Pool",
    shield: "Security",
    plane: "Airport",
    gym: "Gym",
  };
  var SEASONS = [
    ["festive", "Festive season", "#c98a2b"],
    ["winter", "Winter & New Year", "#3d7a8c"],
    ["summer", "Summer", "#d1a02f"],
    ["monsoon", "Monsoon", "#2f8a77"],
  ];
  var FEATURES = [
    ["desk", "Work desk", "Shows a tick in the compare table."],
    ["shower", "Rain shower", "Shows a tick in the compare table."],
    ["lounge", "Sitting area", "A sofa or lounge corner."],
    ["dining", "Dining nook", "A small table for meals."],
    ["apart", "Separate sleeping area", "Good for families."],
  ];
  var TAGS = [
    [
      "family",
      "Family friendly",
      'Appears under the "Family friendly" filter.',
    ],
    ["signature", "Signature", "Marks it as one of your showpiece rooms."],
    ["accessible", "Accessible", "Step-free access and adapted bathroom."],
    ["romantic", "Romantic", "Great for couples and celebrations."],
  ];
  var BEDS = [
    "King bed",
    "Queen bed",
    "2 twin beds",
    "King bed + lounge",
    "King + sofa bed",
    "2 queen beds",
  ];

  /* ======================================================================
     helpers
     ====================================================================== */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function ic(n, c) {
    return (
      '<svg class="i' +
      (c ? " " + c : "") +
      '"><use href="#ic-' +
      n +
      '"/></svg>'
    );
  }
  function am(n) {
    return '<svg class="i"><use href="#am-' + n + '"/></svg>';
  }
  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }
  function inr(n) {
    return Number(n || 0).toLocaleString("en-IN");
  }
  function num(v) {
    return v === "" || v == null ? null : Number(v);
  }
  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }
  function img(p) {
    return p
      ? "../" + p
      : "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#e6e1d3"/></svg>',
          );
  }
  function fmtDT(t) {
    return new Date(t * 1000).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function ago(t) {
    var s = Math.max(0, Math.floor(Date.now() / 1000 - t));
    if (s < 45) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 172800) return "Yesterday";
    return new Date(t * 1000).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  }
  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments,
        c = this;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(c, a);
      }, ms);
    };
  }
  function slugify(s) {
    return String(s)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }
  function getPath(o, p) {
    return p.split(".").reduce(function (a, k) {
      return a == null ? a : a[k];
    }, o);
  }
  function setPath(o, p, v) {
    var k = p.split("."),
      last = k.pop(),
      t = k.reduce(function (a, x) {
        return a[x];
      }, o);
    t[last] = v;
  }
  function tween(from, to, dur, step) {
    if (reduce || from === to) {
      step(to);
      return;
    }
    var t0 = performance.now();
    (function f(t) {
      var p = Math.min(1, (t - t0) / dur);
      step(from + (to - from) * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }
  function sortRooms() {
    S.rooms.sort(function (a, b) {
      return a.rank - b.rank;
    });
  }
  function findRoom(id) {
    for (var i = 0; i < S.rooms.length; i++)
      if (S.rooms[i].id === id) return S.rooms[i];
    return null;
  }

  function newDraft() {
    return {
      id: "",
      name: "",
      category: "room",
      tags: [],
      badge: { text: "", style: "light" },
      status: "draft",
      featured: false,
      short: "",
      tagline: "",
      description: "",
      notes:
        "Check-in from 2:00 PM, check-out by 11:00 AM. Extra bed on request, subject to availability. Breakfast, Wi-Fi, parking and pool access are included.",
      size: 30,
      guests: 2,
      bed: "King bed",
      view: "",
      inventory: 1,
      extraBed: { available: false, price: 0 },
      price: 5000,
      seasonal: { festive: "", winter: "", summer: "", monsoon: "" },
      image: "",
      imageAlt: "",
      gallery: [],
      amenities: [
        { icon: "wifi", label: "Free Wi-Fi" },
        { icon: "snow", label: "Air-conditioning" },
        { icon: "tv", label: "Flat-screen TV" },
        { icon: "cup", label: "Tea & coffee maker" },
      ],
      features: {
        desk: false,
        shower: false,
        lounge: false,
        dining: false,
        apart: false,
      },
      seoTitle: "",
      seoDescription: "",
    };
  }

  /* ---------- server calls ---------- */
  function call(action, body) {
    var o = {
      method: body === undefined ? "GET" : "POST",
      headers: { "X-CSRF-Token": S.csrf },
      credentials: "same-origin",
    };
    if (body instanceof FormData) o.body = body;
    else if (body !== undefined) {
      o.headers["Content-Type"] = "application/json";
      o.body = JSON.stringify(body);
    }
    return fetch("api.php?a=" + action, o)
      .then(function (r) {
        return r
          .json()
          .catch(function () {
            return { ok: false, error: "The server sent an unexpected reply." };
          })
          .then(function (j) {
            return { r: r, j: j };
          });
      })
      .then(function (x) {
        if (x.r.status === 401) {
          location.href = "login.php?expired=1";
          throw new Error("signed-out");
        }
        if (!x.j.ok) {
          var e = new Error(x.j.error || "Something went wrong.");
          e.data = x.j;
          throw e;
        }
        return x.j;
      });
  }

  /* ---------- toast + modal ---------- */
  function toast(msg, type, ms) {
    var el = document.createElement("div");
    el.className = "toast" + (type === "err" ? " toast--err" : "");
    el.innerHTML =
      ic(type === "err" ? "alert" : "check") + "<span>" + esc(msg) + "</span>";
    $("#toasts").appendChild(el);
    setTimeout(
      function () {
        el.classList.add("is-out");
        setTimeout(function () {
          el.remove();
        }, 350);
      },
      ms || (type === "err" ? 5200 : 3000),
    );
  }
  function modal(html, opt) {
    opt = opt || {};
    var root = $("#modalRoot"),
      el = document.createElement("div"),
      prev = document.activeElement;
    el.className = "mdl";
    el.innerHTML =
      '<div class="mdl__box' +
      (opt.large ? " mdl__box--lg" : "") +
      '" role="dialog" aria-modal="true">' +
      html +
      "</div>";
    root.appendChild(el);
    document.body.style.overflow = "hidden";
    var api = {
      el: el,
      close: function (v) {
        el.classList.add("is-out");
        setTimeout(function () {
          el.remove();
          if (!$(".mdl")) document.body.style.overflow = "";
          if (prev && prev.focus) prev.focus();
          if (opt.onClose) opt.onClose(v);
        }, 190);
        document.removeEventListener("keydown", onKey);
      },
    };
    function onKey(e) {
      if (e.key === "Escape" && el === root.lastElementChild) api.close(false);
    }
    document.addEventListener("keydown", onKey);
    el.addEventListener("mousedown", function (e) {
      if (e.target === el) api.close(false);
    });
    $$("[data-close]", el).forEach(function (b) {
      b.addEventListener("click", function () {
        api.close(false);
      });
    });
    var f = $("[data-autofocus]", el) || $(".btn", el);
    if (f)
      setTimeout(function () {
        f.focus();
      }, 60);
    return api;
  }
  function confirmBox(o) {
    return new Promise(function (res) {
      var done = false;
      var m = modal(
        '<div class="mdl__ico">' +
          ic(o.icon || "trash") +
          '</div><div class="mdl__h"><h2>' +
          esc(o.title) +
          '</h2></div><div class="mdl__b">' +
          o.text +
          "</div>" +
          '<div class="mdl__f"><button class="btn btn--ghost" data-close>' +
          esc(o.cancel || "Cancel") +
          '</button><button class="btn ' +
          (o.danger === false ? "btn--ink" : "btn--danger") +
          '" data-ok data-autofocus>' +
          esc(o.ok || "Delete") +
          "</button></div>",
        {
          onClose: function () {
            if (!done) res(false);
          },
        },
      );
      $("[data-ok]", m.el).addEventListener("click", function () {
        done = true;
        res(true);
        m.close(true);
      });
    });
  }
  function busy(btn, on) {
    if (btn) {
      btn.classList.toggle("is-busy", on);
      btn.disabled = on;
    }
  }
  function setHead(title, crumbText, actions) {
    pageTitle.textContent = title;
    crumb.textContent = crumbText;
    topActions.innerHTML = actions || "";
    document.title = title + " | Unicorn Hospitality Admin";
  }
  function replay() {
    view.style.animation = "none";
    void view.offsetWidth;
    view.style.animation = "";
  }

  /* ======================================================================
     ROUTER
     ====================================================================== */
  function parse() {
    var p = location.hash.replace(/^#\/?/, "").split("/");
    if (p[0] === "rooms") {
      if (p[1] === "new") return { name: "new" };
      if (p[1] === "edit" && p[2])
        return { name: "edit", id: decodeURIComponent(p[2]) };
      return { name: "rooms" };
    }
    if (["activity", "backup", "account", "reservations", "coupons"].indexOf(p[0]) > -1)
      return { name: p[0] };
    return { name: "rooms" };
  }
  function go(h, replace) {
    if (replace) history.replaceState(null, "", h);
    else location.hash = h;
    if (replace) {
      S.cur = location.hash;
      route();
    }
  }
  function dirty() {
    return !!(S.edit && S.edit.dirty);
  }

  window.addEventListener("hashchange", function () {
    if (S.reverting) {
      S.reverting = false;
      return;
    }
    if (
      (dirty() && parse().name !== "edit") ||
      (dirty() && parse().id !== S.edit.routeId)
    ) {
      var target = location.hash;
      S.reverting = true;
      location.hash = S.cur;
      confirmBox({
        title: "Leave without saving?",
        icon: "alert",
        text: "You have changes that are not saved yet. If you leave now they will be lost.",
        ok: "Leave page",
        cancel: "Keep editing",
        danger: true,
      }).then(function (ok) {
        if (ok) {
          S.edit.dirty = false;
          location.hash = target;
        }
      });
      return;
    }
    S.cur = location.hash;
    route();
  });
  window.addEventListener("beforeunload", function (e) {
    if (dirty()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  function route() {
    var r = parse();
    $$("#nav a").forEach(function (a) {
      var on =
        a.getAttribute("data-nav") ===
        (r.name === "new" || r.name === "edit" ? "rooms" : r.name);
      a.classList.toggle("is-on", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    $("#ad").classList.remove("is-open");
    S.edit = r.name === "new" || r.name === "edit" ? S.edit : null;
    replay();
    window.scrollTo(0, 0);
    ({
      rooms: viewRooms,
      new: function () {
        viewEdit(null);
      },
      edit: function () {
        viewEdit(r.id);
      },
      activity: viewActivity,
      backup: viewBackup,
      account: viewAccount,
      /* drawn by admin-bookings.js */
      reservations: function () { S.edit = null; window.UchAdminExt.reservations(); },
      coupons: function () { S.edit = null; window.UchAdminExt.coupons(); },
    })[r.name]();
  }

  /* ======================================================================
     ROOMS LIST
     ====================================================================== */
  function viewRooms() {
    sortRooms();
    S.edit = null;
    setHead(
      "Rooms & Suites",
      "Manage",
      '<a class="btn btn--gold" href="#/rooms/new">' +
        ic("plus") +
        "<span>Add room</span></a>",
    );
    var pub = S.rooms.filter(function (r) {
      return r.status === "published";
    });
    var avg = pub.length
      ? Math.round(
          pub.reduce(function (a, r) {
            return a + r.price;
          }, 0) / pub.length,
        )
      : 0;
    var inv = S.rooms.reduce(function (a, r) {
      return a + (r.inventory || 0);
    }, 0);
    var stat = function (i, label, val, sub, cls, pre) {
      return (
        '<div class="stat ' +
        (cls || "") +
        '" style="--i:' +
        i +
        '"><small>' +
        label +
        '</small><b data-n="' +
        val +
        '" data-pre="' +
        (pre || "") +
        '">' +
        (pre || "") +
        "0</b><span>" +
        sub +
        "</span></div>"
      );
    };
    view.innerHTML =
      (S.saved
        ? ""
        : '<div class="note note--blue" style="margin-bottom:18px">' +
          ic("info") +
          "<div><b>Starter content.</b> These are the rooms currently on your website. Make any change and they are saved here, ready to manage.</div></div>") +
      '<div class="stats">' +
      stat(0, "Rooms & suites", S.rooms.length, "in your list", "stat--ink") +
      stat(1, "Published", pub.length, "visible to guests") +
      stat(2, "Drafts", S.rooms.length - pub.length, "hidden from guests") +
      stat(3, "Average rate", avg, "per night, published rooms", "", "₹") +
      "</div>" +
      '<div class="bar">' +
      '<div class="search">' +
      ic("search") +
      '<input type="search" id="q" placeholder="Search rooms (press / )" value="' +
      esc(S.list.q) +
      '" aria-label="Search rooms"></div>' +
      '<div class="chips" id="chips">' +
      [
        ["all", "All"],
        ["published", "Published"],
        ["draft", "Drafts"],
        ["room", "Rooms"],
        ["suite", "Suites"],
        ["featured", "Featured"],
      ]
        .map(function (c) {
          return (
            '<button type="button" class="chip" data-act="filter" data-v="' +
            c[0] +
            '" aria-pressed="' +
            (S.list.filter === c[0]) +
            '">' +
            c[1] +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<select class="sel" id="sort" aria-label="Sort rooms">' +
      [
        ["order", "Website order"],
        ["name", "Name A to Z"],
        ["price-asc", "Price: low to high"],
        ["price-desc", "Price: high to low"],
        ["updated", "Recently updated"],
      ]
        .map(function (o) {
          return (
            '<option value="' +
            o[0] +
            '"' +
            (S.list.sort === o[0] ? " selected" : "") +
            ">" +
            o[1] +
            "</option>"
          );
        })
        .join("") +
      "</select>" +
      '<span class="bar__count" id="count"></span>' +
      "</div>" +
      '<div class="rows" id="rows"></div>';
    updateStats();
    $("#q").addEventListener(
      "input",
      debounce(function (e) {
        S.list.q = e.target.value;
        renderRows();
      }, 120),
    );
    $("#sort").addEventListener("change", function (e) {
      S.list.sort = e.target.value;
      renderRows();
    });
    renderRows(true);
    updateNav();
  }
  function updateStats() {
    var pub = S.rooms.filter(function (r) {
      return r.status === "published";
    });
    var vals = [
      S.rooms.length,
      pub.length,
      S.rooms.length - pub.length,
      pub.length
        ? Math.round(
            pub.reduce(function (a, r) {
              return a + r.price;
            }, 0) / pub.length,
          )
        : 0,
    ];
    $$(".stat b", view).forEach(function (b, i) {
      var pre = b.getAttribute("data-pre"),
        from = parseInt(String(b.textContent).replace(/[^0-9]/g, ""), 10) || 0;
      b.setAttribute("data-n", vals[i]);
      tween(from, vals[i], 700, function (v) {
        b.textContent = pre + inr(Math.round(v));
      });
    });
  }
  function visibleRooms() {
    var q = S.list.q.trim().toLowerCase(),
      f = S.list.filter;
    var list = S.rooms.filter(function (r) {
      if (f === "published" && r.status !== "published") return false;
      if (f === "draft" && r.status !== "draft") return false;
      if ((f === "room" || f === "suite") && r.category !== f) return false;
      if (f === "featured" && !r.featured) return false;
      return (
        !q ||
        (r.name + " " + r.id + " " + r.bed + " " + r.view + " " + r.tagline)
          .toLowerCase()
          .indexOf(q) > -1
      );
    });
    var s = S.list.sort;
    if (s === "price-asc")
      list.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
    else if (s === "")
      list.sort(function (a, b) {
        return a.price - b.price;
      });
    else if (s === "price-desc")
      list.sort(function (a, b) {
        return b.price - a.price;
      });
    else if (s === "updated")
      list.sort(function (a, b) {
        return b.updatedAt - a.updatedAt;
      });
    return list;
  }
  function renderRows(first) {
    var host = $("#rows");
    if (!host) return;
    host.classList.toggle("no-anim", !first);
    var list = visibleRooms(),
      canOrder =
        S.list.sort === "order" && S.list.filter === "all" && !S.list.q.trim();
    $("#count").textContent =
      "Showing " + list.length + " of " + S.rooms.length;
    $$("#chips .chip").forEach(function (c) {
      c.setAttribute(
        "aria-pressed",
        String(c.getAttribute("data-v") === S.list.filter),
      );
    });
    if (!list.length) {
      host.innerHTML =
        '<div class="empty"><span class="ico">' +
        ic("bed") +
        "</span><h3>" +
        (S.rooms.length ? "No rooms match" : "No rooms yet") +
        "</h3><p>" +
        (S.rooms.length
          ? "Try a different search or filter."
          : "Add your first room or suite. It only takes a minute.") +
        '</p><a class="btn btn--gold" href="#/rooms/new">' +
        ic("plus") +
        "<span>Add a room</span></a></div>";
      return;
    }
    host.innerHTML = list
      .map(function (r, i) {
        var pubd = r.status === "published",
          first = S.rooms[0] && S.rooms[0].id === r.id,
          last = S.rooms[S.rooms.length - 1].id === r.id;
        return (
          '<article class="rw' +
          (pubd ? "" : " is-draft") +
          (canOrder ? "" : " no-order") +
          '" data-id="' +
          esc(r.id) +
          '" style="--i:' +
          Math.min(i, 12) +
          '">' +
          '<div class="rw__order"><span class="rw__grip" data-grip title="Drag to change the order">' +
          ic("grip") +
          '</span><div class="rw__arrows"><button type="button" data-act="up" aria-label="Move up"' +
          (first ? " disabled" : "") +
          ">" +
          ic("up") +
          '</button><button type="button" data-act="down" aria-label="Move down"' +
          (last ? " disabled" : "") +
          ">" +
          ic("down") +
          "</button></div></div>" +
          '<img class="rw__img" src="' +
          esc(img(r.image)) +
          '" alt="" loading="lazy">' +
          '<div class="rw__name"><b>' +
          esc(r.name) +
          "</b><small><code>#" +
          esc(r.id) +
          "</code>" +
          (r.badge && r.badge.text
            ? '<span class="badge badge--gold">' + esc(r.badge.text) + "</span>"
            : "") +
          (r.featured
            ? '<span class="badge badge--gold">' +
              ic("star").replace(
                'class="i"',
                'class="i" style="width:12px;height:12px"',
              ) +
              " Featured</span>"
            : "") +
          "</small></div>" +
          '<div class="rw__meta"><span>' +
          ic("area") +
          r.size +
          " sqm</span><span>" +
          ic("people") +
          "Up to " +
          r.guests +
          " guests</span></div>" +
          '<div class="rw__price">₹' +
          inr(r.price) +
          "<small>" +
          (r.category === "suite" ? "Suite" : "Room") +
          " · per night</small></div>" +
          '<div class="rw__status"><label class="sw" title="' +
          (pubd ? "Published. Click to hide" : "Draft. Click to publish") +
          '"><input type="checkbox" data-act="toggle" aria-label="Published"' +
          (pubd ? " checked" : "") +
          '><i></i></label><span class="badge ' +
          (pubd ? "badge--ok" : "badge--draft") +
          '"><i></i>' +
          (pubd ? "Live" : "Draft") +
          "</span></div>" +
          '<div class="rw__act"><a class="icon-btn" href="#/rooms/edit/' +
          encodeURIComponent(r.id) +
          '" title="Edit" aria-label="Edit ' +
          esc(r.name) +
          '">' +
          ic("edit") +
          '</a><button type="button" class="icon-btn" data-act="dup" title="Duplicate" aria-label="Duplicate">' +
          ic("copy") +
          "</button>" +
          (pubd
            ? '<a class="icon-btn" href="../rooms.html#' +
              esc(r.id) +
              '" target="_blank" rel="noopener" title="View on the website" aria-label="View on website">' +
              ic("ext") +
              "</a>"
            : "") +
          '<button type="button" class="icon-btn icon-btn--danger" data-act="del" title="Delete" aria-label="Delete">' +
          ic("trash") +
          "</button></div>" +
          "</article>"
        );
      })
      .join("");
  }
  function updateNav() {
    var n = $("#navCount");
    if (n) n.textContent = S.rooms.length;
  }

  /* ---- list actions ---- */
  var A = {};
  A.reload = function () {
    location.reload();
  };
  A.filter = function (t) {
    S.list.filter = t.getAttribute("data-v");
    renderRows();
  };
  A.toggle = function (t) {
    var row = t.closest(".rw"),
      r = findRoom(row.getAttribute("data-id")),
      to = t.checked ? "published" : "draft";
    t.parentNode.classList.add("is-busy");
    call("status", { id: r.id, status: to })
      .then(function (res) {
        Object.assign(r, res.room);
        toast(
          r.name +
            (to === "published"
              ? " is now live on the website"
              : " is now hidden (draft)"),
        );
        viewRowsRefresh();
      })
      .catch(function (e) {
        t.checked = !t.checked;
        t.parentNode.classList.remove("is-busy");
        toast(e.message, "err");
      });
  };
  function viewRowsRefresh() {
    if (parse().name === "rooms") {
      updateStats();
      renderRows();
      updateNav();
    }
  }
  A.dup = function (t) {
    var id = t.closest(".rw").getAttribute("data-id");
    busy(t, true);
    call("duplicate", { id: id })
      .then(function (res) {
        S.rooms.push(res.room);
        sortRooms();
        toast("Copy created as a draft");
        go("#/rooms/edit/" + encodeURIComponent(res.room.id));
      })
      .catch(function (e) {
        busy(t, false);
        toast(e.message, "err");
      });
  };
  A.del = function (t) {
    var r = findRoom(t.closest(".rw").getAttribute("data-id"));
    confirmBox({
      title: "Delete " + r.name + "?",
      text: "This removes the room from your website and your list. Pictures you uploaded for it are deleted too. This cannot be undone.<br><br>If you only want to hide it for now, switch it to <b>Draft</b> instead.",
      ok: "Delete room",
    }).then(function (ok) {
      if (!ok) return;
      call("delete", { id: r.id })
        .then(function (res) {
          S.rooms = res.rooms;
          toast(r.name + " was deleted");
          viewRowsRefresh();
        })
        .catch(function (e) {
          toast(e.message, "err");
        });
    });
  };
  var reorderSave = debounce(function () {
    call("reorder", {
      ids: S.rooms.map(function (r) {
        return r.id;
      }),
    })
      .then(function () {
        toast("New order saved");
      })
      .catch(function (e) {
        toast(e.message, "err");
      });
  }, 600);
  function move(id, delta) {
    var i = S.rooms.findIndex(function (r) {
        return r.id === id;
      }),
      j = i + delta;
    if (j < 0 || j >= S.rooms.length) return;
    var x = S.rooms.splice(i, 1)[0];
    S.rooms.splice(j, 0, x);
    S.rooms.forEach(function (r, k) {
      r.rank = k + 1;
    });
    renderRows();
    reorderSave();
  }
  A.up = function (t) {
    move(t.closest(".rw").getAttribute("data-id"), -1);
  };
  A.down = function (t) {
    move(t.closest(".rw").getAttribute("data-id"), 1);
  };

  /* drag and drop ordering */
  var drag = null;
  view.addEventListener("pointerdown", function (e) {
    var g = e.target.closest("[data-grip]");
    if (g) g.closest(".rw").draggable = true;
  });
  view.addEventListener("dragstart", function (e) {
    var row = e.target.closest && e.target.closest(".rw");
    if (!row || !row.draggable) return;
    drag = row.getAttribute("data-id");
    row.classList.add("is-drag");
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", drag);
    } catch (x) {}
  });
  view.addEventListener("dragover", function (e) {
    if (!drag) return;
    var row = e.target.closest(".rw");
    if (!row) return;
    e.preventDefault();
    $$(".rw.is-over").forEach(function (r) {
      r.classList.remove("is-over");
    });
    if (row.getAttribute("data-id") !== drag) row.classList.add("is-over");
  });
  view.addEventListener("drop", function (e) {
    if (!drag) return;
    var row = e.target.closest(".rw");
    if (!row) return;
    e.preventDefault();
    var to = row.getAttribute("data-id");
    if (to === drag) return;
    var from = S.rooms.findIndex(function (r) {
        return r.id === drag;
      }),
      x = S.rooms.splice(from, 1)[0],
      at = S.rooms.findIndex(function (r) {
        return r.id === to;
      });
    var rect = row.getBoundingClientRect();
    if (e.clientY > rect.top + rect.height / 2) at++;
    S.rooms.splice(at, 0, x);
    S.rooms.forEach(function (r, k) {
      r.rank = k + 1;
    });
    drag = null;
    renderRows();
    reorderSave();
  });
  document.addEventListener("pointerup", function () {
    if (!drag)
      $$(".rw").forEach(function (r) {
        r.draggable = false;
      });
  });
  view.addEventListener("dragend", function () {
    drag = null;
    $$(".rw").forEach(function (r) {
      r.classList.remove("is-drag", "is-over");
      r.draggable = false;
    });
  });

  /* ======================================================================
     ADD / EDIT ROOM
     ====================================================================== */
  function viewEdit(id) {
    var orig = null;
    if (id) {
      orig = findRoom(id);
      if (!orig) {
        toast("That room was not found", "err");
        go("#/rooms", true);
        return;
      }
    }
    var d = orig ? clone(orig) : newDraft();
    ["festive", "winter", "summer", "monsoon"].forEach(function (k) {
      if (d.seasonal[k] == null) d.seasonal[k] = "";
    });
    S.edit = {
      orig: orig ? clone(orig) : null,
      draft: d,
      errors: {},
      dirty: false,
      snap: JSON.stringify(d),
      idTouched: !!orig,
      routeId: id || undefined,
    };
    renderEdit();
  }
  function errKey(p) {
    return p === "extraBed.price" ? "extraBedPrice" : p.replace(".", "_");
  }
  function fld(o) {
    var d = S.edit.draft,
      v = getPath(d, o.p),
      k = errKey(o.p),
      er = S.edit.errors[k];
    var attrs =
      'id="f-' +
      o.p.replace(".", "-") +
      '" class="in" data-f="' +
      o.p +
      '"' +
      (o.t ? ' data-t="' + o.t + '"' : "") +
      (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "") +
      (o.max ? ' maxlength="' + o.max + '"' : "") +
      (o.list ? ' list="' + o.list + '"' : "");
    var input;
    if (o.type === "textarea")
      input =
        "<textarea " +
        attrs +
        ' rows="' +
        (o.rows || 4) +
        '">' +
        esc(v) +
        "</textarea>";
    else {
      input =
        "<input " +
        attrs +
        ' type="' +
        (o.type || "text") +
        '" value="' +
        esc(v) +
        '"' +
        (o.type === "number" ? ' inputmode="numeric" min="0" step="1"' : "") +
        ">";
      if (o.pre)
        input =
          '<div class="in-wrap"><span>' + o.pre + "</span>" + input + "</div>";
      if (o.suf)
        input =
          '<div class="in-wrap in-wrap--r"><span>' +
          o.suf +
          "</span>" +
          input +
          "</div>";
    }
    return (
      '<div class="fl' +
      (er ? " is-bad" : "") +
      (o.cls ? " " + o.cls : "") +
      '" data-key="' +
      k +
      '"><label for="f-' +
      o.p.replace(".", "-") +
      '"><span>' +
      o.label +
      (o.req ? ' <span style="color:var(--color-danger)">*</span>' : "") +
      "</span>" +
      (o.max
        ? '<small class="count" data-count="' +
          o.p +
          '">' +
          String(v || "").length +
          "/" +
          o.max +
          "</small>"
        : o.small
          ? "<small>" + o.small + "</small>"
          : "") +
      "</label>" +
      input +
      (o.hint ? '<span class="hint">' + o.hint + "</span>" : "") +
      '<span class="err">' +
      esc(er || "") +
      "</span></div>"
    );
  }
  function card(icon, title, sub, body, id) {
    return (
      '<section class="card" id="' +
      id +
      '"><div class="card__h"><span class="ico">' +
      ic(icon) +
      "</span><div><h2>" +
      title +
      "</h2><p>" +
      sub +
      '</p></div></div><div class="card__b">' +
      body +
      "</div></section>"
    );
  }
  function seg(p, opts) {
    var v = getPath(S.edit.draft, p);
    return (
      '<div class="seg" role="group">' +
      opts
        .map(function (o) {
          return (
            '<button type="button" data-act="set" data-p="' +
            p +
            '" data-v="' +
            o[0] +
            '" aria-pressed="' +
            (v === o[0]) +
            '">' +
            o[1] +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }
  function tgl(p, title, sub, sm) {
    return (
      '<label class="tgl' +
      (sm ? " is-sm" : "") +
      '"><span><b>' +
      title +
      "</b>" +
      (sub ? "<small>" + sub + "</small>" : "") +
      '</span><span class="sw"><input type="checkbox" data-f="' +
      p +
      '" data-t="bool"' +
      (getPath(S.edit.draft, p) ? " checked" : "") +
      "><i></i></span></label>"
    );
  }

  function renderEdit() {
    var e = S.edit,
      d = e.draft,
      isNew = !e.orig,
      y = window.scrollY;
    setHead(
      isNew ? "Add a new room" : "Edit " + e.orig.name,
      "Rooms",
      '<a class="btn btn--ghost" href="#/rooms">' +
        ic("x") +
        "<span>Close</span></a>",
    );
    var basics =
      '<div class="grid2">' +
      fld({
        p: "name",
        label: "Room name",
        req: true,
        max: 60,
        ph: "e.g. Deluxe Room",
      }) +
      '<div class="fl" data-key="id"><label for="f-id"><span>Web address</span><small>used in links</small></label><div class="slugbox"><span>rooms.html#</span><input id="f-id" class="in" data-f="id" value="' +
      esc(d.id) +
      '" maxlength="40" placeholder="auto from the name" spellcheck="false"></div><span class="hint">' +
      (isNew
        ? "Created from the name. You can change it now."
        : "Changing this changes links to the room, for example rooms.html#" +
          esc(e.orig.id) +
          ".") +
      '</span><span class="err">' +
      esc(e.errors.id || "") +
      "</span></div></div>" +
      '<div class="grid2" style="margin-top:16px"><div class="fl"><span class="lbl">Type</span>' +
      seg("category", [
        ["room", "Room"],
        ["suite", "Suite"],
      ]) +
      "</div>" +
      '<div class="fl"><span class="lbl">Badge on the picture <small>optional</small></span><div style="display:flex;gap:8px"><input class="in" data-f="badge.text" maxlength="24" placeholder="e.g. Most booked" value="' +
      esc(d.badge.text) +
      '" id="f-badge-text">' +
      seg("badge.style", [
        ["light", "White"],
        ["gold", "Gold"],
      ]) +
      "</div></div></div>" +
      '<div style="margin-top:16px" class="fl"><span class="lbl">Highlights <small>show up as filters and labels</small></span><div class="chips">' +
      TAGS.map(function (t) {
        return (
          '<button type="button" class="chip" data-act="tag" data-v="' +
          t[0] +
          '" aria-pressed="' +
          (d.tags.indexOf(t[0]) > -1) +
          '" title="' +
          t[2] +
          '">' +
          t[1] +
          "</button>"
        );
      }).join("") +
      "</div></div>" +
      '<div style="margin-top:16px">' +
      fld({
        p: "short",
        label: "Short description",
        max: 180,
        type: "textarea",
        rows: 3,
        ph: "One or two lines that sell the room on the listing card.",
        hint: "Shown on the room card. Needed to publish.",
      }) +
      "</div>" +
      '<div style="margin-top:16px">' +
      fld({
        p: "tagline",
        label: "Tagline",
        max: 80,
        ph: "e.g. Calm, classic comfort",
        hint: "A short line under the room name in the detail window.",
      }) +
      "</div>";
    var details =
      '<div class="grid3">' +
      fld({
        p: "size",
        label: "Room size",
        type: "number",
        t: "int",
        suf: "sqm",
        req: true,
      }) +
      fld({
        p: "guests",
        label: "Sleeps up to",
        type: "number",
        t: "int",
        suf: "guests",
        req: true,
      }) +
      fld({
        p: "inventory",
        label: "Rooms of this type",
        type: "number",
        t: "int",
        suf: "rooms",
        hint: "How many you can sell.",
      }) +
      "</div>" +
      '<div class="grid2" style="margin-top:16px">' +
      fld({
        p: "bed",
        label: "Bed type",
        req: true,
        max: 40,
        list: "bedList",
      }) +
      '<datalist id="bedList">' +
      BEDS.map(function (b) {
        return '<option value="' + b + '">';
      }).join("") +
      "</datalist>" +
      fld({
        p: "view",
        label: "View",
        max: 40,
        ph: "e.g. City view, Garden side",
      }) +
      "</div>" +
      '<div class="grid2" style="margin-top:16px">' +
      tgl(
        "extraBed.available",
        "Extra bed available",
        "Guests can ask for an extra bed.",
      ) +
      "<div>" +
      fld({
        p: "extraBed.price",
        label: "Extra bed charge",
        type: "number",
        t: "int",
        pre: "₹",
        hint: "Per night. Leave 0 if free.",
      }) +
      "</div></div>";
    var pricing =
      '<div class="grid2">' +
      fld({
        p: "price",
        label: "Base price per night",
        type: "number",
        t: "int",
        pre: "₹",
        req: true,
        hint: 'Shown as "From ₹..." on the website. Taxes are extra.',
      }) +
      '<div class="note" style="align-self:end">' +
      ic("info") +
      "<div>Seasonal prices are optional. Leave them empty to use the base price all year.</div></div></div>" +
      '<div class="sea" style="margin-top:18px">' +
      SEASONS.map(function (s) {
        return fld({
          p: "seasonal." + s[0],
          label:
            '<span class="dot" style="background:' + s[2] + '"></span>' + s[1],
          type: "number",
          t: "intnull",
          pre: "₹",
          ph: "Base",
        });
      }).join("") +
      "</div>";
    var text =
      fld({
        p: "description",
        label: "Full description",
        type: "textarea",
        rows: 6,
        max: 1200,
        ph: "Describe the room: light, bed, bathroom, mood, who it suits.",
        hint: "Shown in the room detail window.",
      }) +
      '<div style="margin-top:16px">' +
      fld({
        p: "notes",
        label: "Good to know",
        type: "textarea",
        rows: 3,
        max: 500,
        hint: "Check-in times, extra bed, what is included.",
      }) +
      "</div>";
    var amen =
      '<div class="lbl" style="font-size:13px;font-weight:600;color:var(--um-ink);margin-bottom:10px">Tap an icon to add it</div><div class="amp">' +
      Object.keys(AMENITY)
        .map(function (k) {
          return (
            '<button type="button" data-act="am-add" data-i="' +
            k +
            '" title="Add ' +
            esc(AMENITY[k]) +
            '">' +
            am(k) +
            "<span>" +
            AM_NAME[k] +
            "</span></button>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="aml" id="aml"></div><div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><button type="button" class="btn btn--ghost btn--sm" data-act="am-new">' +
      ic("plus") +
      '<span>Add your own</span></button><span class="hint" id="amCount" style="font-size:12.5px;color:var(--rts-para)"></span></div>' +
      '<div class="fl" data-key="amenities"><span class="err">' +
      esc(e.errors.amenities || "") +
      "</span></div>" +
      '<div style="margin-top:22px" class="lbl"><span style="font-size:13px;font-weight:600;color:var(--um-ink)">Compare table ticks</span></div><div class="feat" style="margin-top:10px">' +
      FEATURES.map(function (f) {
        return tgl("features." + f[0], f[1], f[2], true);
      }).join("") +
      "</div>";
    var pics =
      '<div class="fl" data-key="image"><span class="lbl">Main picture <small>shown on the card. Portrait or landscape both work.</small></span><div id="mainPic"></div><span class="err">' +
      esc(e.errors.image || "") +
      "</span></div>" +
      '<div style="margin-top:16px">' +
      fld({
        p: "imageAlt",
        label: "Picture description (for screen readers)",
        max: 120,
        ph: "e.g. King bed with soft drapes and a lamp",
      }) +
      "</div>" +
      '<div class="fl" style="margin-top:20px"><span class="lbl">More pictures <small id="galN"></small></span><div class="gal" id="gal"></div></div>';
    var seo =
      '<div class="grid2">' +
      fld({
        p: "seoTitle",
        label: "Search title",
        max: 70,
        hint: "Leave empty to use the room name.",
      }) +
      fld({
        p: "seoDescription",
        label: "Search description",
        type: "textarea",
        rows: 3,
        max: 160,
      }) +
      "</div>";
    var pubd = d.status === "published";
    view.innerHTML =
      '<div class="ed"><div class="ed__main">' +
      card(
        "bed",
        "The basics",
        "Name, type and the lines that appear on the listing.",
        basics,
        "s-basics",
      ) +
      card(
        "area",
        "Room details",
        "Size, capacity and beds.",
        details,
        "s-details",
      ) +
      card(
        "rupee",
        "Pricing",
        "Base rate and optional seasonal rates.",
        pricing,
        "s-pricing",
      ) +
      card(
        "edit",
        "Description",
        "The longer story for the detail window.",
        text,
        "s-text",
      ) +
      card(
        "check",
        "Amenities",
        "What guests get in this room.",
        amen,
        "s-amen",
      ) +
      card(
        "image",
        "Pictures",
        "A great main picture sells the room.",
        pics,
        "s-pics",
      ) +
      card(
        "search",
        "Search appearance",
        "Optional. How the room may appear in search results.",
        seo,
        "s-seo",
      ) +
      '</div><aside class="ed__side">' +
      '<div class="card pub"><h3>Publishing</h3>' +
      '<div class="pub__row"><span><b style="color:var(--um-ink);font-size:14px">Status</b><small style="display:block;color:var(--rts-para);font-size:12.5px">Drafts are hidden from guests.</small></span>' +
      seg("status", [
        ["draft", "Draft"],
        ["published", "Live"],
      ]) +
      "</div>" +
      '<div class="pub__row"><span><b style="color:var(--um-ink);font-size:14px">Featured</b><small style="display:block;color:var(--rts-para);font-size:12.5px">Highlight on the website.</small></span><label class="sw"><input type="checkbox" data-f="featured" data-t="bool"' +
      (d.featured ? " checked" : "") +
      "><i></i></label></div>" +
      '<div class="pub__meta">' +
      (isNew
        ? "This room has not been saved yet."
        : "Last saved " +
          esc(fmtDT(e.orig.updatedAt)) +
          " by <b>" +
          esc(e.orig.updatedBy || "admin") +
          "</b>.") +
      "</div></div>" +
      '<div class="card pv-card"><h3>Live preview <small>Website card</small></h3><div id="pv"></div></div>' +
      "</aside></div>" +
      '<div class="savebar" id="savebar"><div class="savebar__msg"><i></i><span id="saveMsg">All changes saved</span></div><div class="savebar__btns"><button type="button" class="btn btn--ghost" data-act="discard">Discard changes</button><button type="button" class="btn btn--ink" data-act="save" id="saveBtn">' +
      ic("save") +
      '<span>Save room</span><i class="btn__spin"></i></button></div></div>';
    renderAmen();
    renderPics();
    updatePreview();
    markDirty(true);
    window.scrollTo(0, y);
  }
  function previewHTML(d) {
    var cat =
      (d.category === "suite" ? "Suite" : "Room") +
      (d.bed ? " · " + esc(d.bed) : "");
    return (
      '<div class="pv"><div class="pv__media">' +
      (d.image
        ? '<img src="' + esc(img(d.image)) + '" alt="">'
        : '<div class="pv__none">No main picture yet</div>') +
      (d.badge.text
        ? '<span class="pv__badge' +
          (d.badge.style === "gold" ? " pv__badge--gold" : "") +
          '">' +
          esc(d.badge.text) +
          "</span>"
        : "") +
      '<span class="pv__heart"><svg class="i" viewBox="0 0 24 24"><path d="M12 20.500s-7.500-4.600-7.500-10.400A4.400 4.400 0 0 1 12 7.200a4.400 4.400 0 0 1 7.500 2.900c0 5.800-7.500 10.400-7.500 10.400z"/></svg></span></div>' +
      '<div class="pv__body"><span class="pv__cat">' +
      cat +
      '</span><h3 class="pv__name">' +
      esc(d.name || "Room name") +
      '</h3><p class="pv__txt">' +
      esc(d.short || "A short description of the room will appear here.") +
      "</p>" +
      '<div class="pv__meta"><span>' +
      ic("area") +
      (d.size || "–") +
      " sqm</span><span>" +
      ic("user") +
      (d.guests || "–") +
      " guests</span><span>" +
      ic("bed") +
      esc(d.bed || "–") +
      "</span></div>" +
      '<div class="pv__foot"><div><small>From</small><strong>₹' +
      inr(d.price) +
      " <sub>/ night</sub></strong></div><span>Reserve</span></div></div></div>"
    );
  }
  function updatePreview() {
    var p = $("#pv");
    if (p) p.innerHTML = previewHTML(S.edit.draft);
  }
  function markDirty(init) {
    var e = S.edit;
    if (!e) return;
    e.dirty = JSON.stringify(e.draft) !== e.snap;
    var bar = $("#savebar");
    if (!bar) return;
    bar.classList.toggle("is-dirty", e.dirty);
    $("#saveMsg").textContent = e.dirty
      ? "You have unsaved changes"
      : e.orig
        ? "All changes saved"
        : "Fill in the details, then save";
    $("[data-act=discard]", bar).hidden = !e.dirty;
  }
  function renderAmen() {
    var d = S.edit.draft,
      host = $("#aml");
    if (!host) return;
    host.innerHTML =
      d.amenities
        .map(function (a, i) {
          return (
            '<div class="amr" data-i="' +
            i +
            '"><select class="sel" data-am="icon" aria-label="Icon">' +
            Object.keys(AMENITY)
              .map(function (k) {
                return (
                  '<option value="' +
                  k +
                  '"' +
                  (a.icon === k ? " selected" : "") +
                  ">" +
                  AM_NAME[k] +
                  "</option>"
                );
              })
              .join("") +
            '</select><input class="in" data-am="label" maxlength="40" value="' +
            esc(a.label) +
            '" aria-label="Amenity name"><div class="amr__btns"><button type="button" class="icon-btn" data-act="am-up" aria-label="Move up"' +
            (i === 0 ? " disabled" : "") +
            ">" +
            ic("up") +
            '</button><button type="button" class="icon-btn" data-act="am-down" aria-label="Move down"' +
            (i === d.amenities.length - 1 ? " disabled" : "") +
            ">" +
            ic("down") +
            '</button><button type="button" class="icon-btn icon-btn--danger" data-act="am-del" aria-label="Remove">' +
            ic("x") +
            "</button></div></div>"
          );
        })
        .join("") ||
      '<p class="hint" style="color:var(--rts-para);font-size:13.5px">No amenities yet. Tap an icon above to add one.</p>';
    var c = $("#amCount");
    if (c) c.textContent = d.amenities.length + " of 14";
  }
  function renderPics() {
    var d = S.edit.draft,
      host = $("#mainPic");
    if (!host) return;
    host.innerHTML =
      '<div class="pic' +
      (d.image ? " has-img" : "") +
      '" id="picBox" tabindex="0" role="button" data-act="pick-main" aria-label="' +
      (d.image ? "Change main picture" : "Add main picture") +
      '">' +
      (d.image
        ? '<img src="' +
          esc(img(d.image)) +
          '" alt=""><div class="pic__tools"><span class="btn btn--ghost btn--sm">' +
          ic("image") +
          'Change</span><button type="button" class="btn btn--danger btn--sm" data-act="rm-main">' +
          ic("trash") +
          "Remove</button></div>"
        : '<div class="pic__empty"><span class="ico">' +
          ic("upload") +
          "</span><b>Add the main picture</b><span>Click to choose or upload, or drop a picture here</span></div>") +
      "</div>";
    var g = $("#gal");
    if (!g) return;
    g.innerHTML =
      d.gallery
        .map(function (p, i) {
          return (
            '<div class="gal__it" style="animation-delay:' +
            i * 0.04 +
            's"><img src="' +
            esc(img(p)) +
            '" alt=""><button type="button" data-act="gal-del" data-i="' +
            i +
            '" aria-label="Remove picture">' +
            ic("x") +
            "</button></div>"
          );
        })
        .join("") +
      (d.gallery.length < 8
        ? '<button type="button" class="gal__add" data-act="gal-add">' +
          ic("plus") +
          "<span>Add</span></button>"
        : "");
    var n = $("#galN");
    if (n) n.textContent = d.gallery.length + " of 8";
  }

  /* ---- edit: field changes (delegated) ---- */
  function onField(e) {
    var t = e.target;
    if (!S.edit) return;
    var am = t.getAttribute && t.getAttribute("data-am");
    if (am) {
      var row = t.closest(".amr"),
        a = S.edit.draft.amenities[+row.getAttribute("data-i")];
      a[am] = t.value;
      if (am === "icon") {
        /* keep label */
      }
      markDirty();
      return;
    }
    var p = t.getAttribute && t.getAttribute("data-f");
    if (!p) return;
    var ty = t.getAttribute("data-t"),
      v;
    if (t.type === "checkbox") v = t.checked;
    else if (ty === "int") v = t.value === "" ? "" : Number(t.value);
    else if (ty === "intnull") v = t.value === "" ? "" : Number(t.value);
    else v = t.value;
    setPath(S.edit.draft, p, v);
    if (p === "name" && !S.edit.idTouched) {
      S.edit.draft.id = slugify(v);
      var id = $("#f-id");
      if (id) id.value = S.edit.draft.id;
    }
    if (p === "id") {
      S.edit.idTouched = true;
    }
    var c = $('[data-count="' + p + '"]');
    if (c) {
      var max = +t.getAttribute("maxlength");
      c.textContent = t.value.length + "/" + max;
      c.classList.toggle("is-warn", t.value.length > max * 0.9);
    }
    var fl = t.closest(".fl");
    if (fl && fl.classList.contains("is-bad")) {
      fl.classList.remove("is-bad");
      delete S.edit.errors[fl.getAttribute("data-key")];
    }
    updatePreview();
    markDirty();
  }
  view.addEventListener("input", onField);
  view.addEventListener("change", function (e) {
    if (e.target.matches("select[data-am], input[type=checkbox][data-f]"))
      onField(e);
  });

  A.set = function (t) {
    var p = t.getAttribute("data-p"),
      v = t.getAttribute("data-v");
    setPath(S.edit.draft, p, v);
    $$('[data-act=set][data-p="' + p + '"]').forEach(function (b) {
      b.setAttribute("aria-pressed", String(b === t));
    });
    updatePreview();
    markDirty();
  };
  A.tag = function (t) {
    var tags = S.edit.draft.tags,
      v = t.getAttribute("data-v"),
      i = tags.indexOf(v);
    if (i > -1) tags.splice(i, 1);
    else tags.push(v);
    t.setAttribute("aria-pressed", String(i < 0));
    markDirty();
  };
  A["am-add"] = function (t) {
    var list = S.edit.draft.amenities;
    if (list.length >= 14) {
      toast("You can add up to 14 amenities", "err");
      return;
    }
    var k = t.getAttribute("data-i");
    list.push({ icon: k, label: AMENITY[k] });
    renderAmen();
    markDirty();
    var rows = $$("#aml .amr");
    if (rows.length) {
      var inp = $("input", rows[rows.length - 1]);
      inp.focus();
      inp.select();
    }
  };
  A["am-new"] = function () {
    var list = S.edit.draft.amenities;
    if (list.length >= 14) {
      toast("You can add up to 14 amenities", "err");
      return;
    }
    list.push({ icon: "shield", label: "" });
    renderAmen();
    markDirty();
    var r = $$("#aml .amr input");
    r[r.length - 1].focus();
  };
  function amMove(t, d) {
    var i = +t.closest(".amr").getAttribute("data-i"),
      l = S.edit.draft.amenities,
      j = i + d;
    if (j < 0 || j >= l.length) return;
    var x = l.splice(i, 1)[0];
    l.splice(j, 0, x);
    renderAmen();
    markDirty();
  }
  A["am-up"] = function (t) {
    amMove(t, -1);
  };
  A["am-down"] = function (t) {
    amMove(t, 1);
  };
  A["am-del"] = function (t) {
    S.edit.draft.amenities.splice(+t.closest(".amr").getAttribute("data-i"), 1);
    renderAmen();
    markDirty();
  };
  A["pick-main"] = function (t, e) {
    if (e.target.closest("[data-act=rm-main]")) return;
    openMedia({
      title: "Choose the main picture",
      multiple: false,
      selected: [S.edit.draft.image],
      onPick: function (p) {
        setMain(p[0]);
      },
    });
  };
  function setMain(p) {
    var d = S.edit.draft;
    d.image = p;
    if (!d.imageAlt && d.name) {
      d.imageAlt = d.name + " at Unicorn Hospitality";
      var a = $("#f-imageAlt");
      if (a) a.value = d.imageAlt;
    }
    var fl = $("[data-key=image]");
    if (fl) fl.classList.remove("is-bad");
    renderPics();
    updatePreview();
    markDirty();
  }
  A["rm-main"] = function (t, e) {
    e.stopPropagation();
    S.edit.draft.image = "";
    renderPics();
    updatePreview();
    markDirty();
  };
  A["gal-add"] = function () {
    openMedia({
      title: "Add pictures to the gallery",
      multiple: true,
      limit: 8 - S.edit.draft.gallery.length,
      selected: [],
      onPick: function (ps) {
        ps.forEach(function (p) {
          var g = S.edit.draft.gallery;
          if (g.length < 8 && g.indexOf(p) < 0) g.push(p);
        });
        renderPics();
        markDirty();
      },
    });
  };
  A["gal-del"] = function (t) {
    S.edit.draft.gallery.splice(+t.getAttribute("data-i"), 1);
    renderPics();
    markDirty();
  };
  A.discard = function () {
    confirmBox({
      title: "Discard your changes?",
      icon: "alert",
      text: "Everything you changed since the last save will be lost.",
      ok: "Discard changes",
      cancel: "Keep editing",
    }).then(function (ok) {
      if (ok) {
        S.edit.draft = clone(S.edit.orig || newDraft());
        ["festive", "winter", "summer", "monsoon"].forEach(function (k) {
          if (S.edit.draft.seasonal[k] == null) S.edit.draft.seasonal[k] = "";
        });
        S.edit.snap = JSON.stringify(S.edit.draft);
        S.edit.errors = {};
        renderEdit();
        toast("Changes discarded");
      }
    });
  };
  /* drop a picture on the main picture box */
  view.addEventListener("dragover", function (e) {
    var b = e.target.closest && e.target.closest("#picBox");
    if (
      b &&
      e.dataTransfer &&
      Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") > -1
    ) {
      e.preventDefault();
      b.classList.add("is-over");
    }
  });
  view.addEventListener("dragleave", function (e) {
    var b = e.target.closest && e.target.closest("#picBox");
    if (b) b.classList.remove("is-over");
  });
  view.addEventListener("drop", function (e) {
    var b = e.target.closest && e.target.closest("#picBox");
    if (!b || !e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    b.classList.remove("is-over");
    uploadFiles([e.dataTransfer.files[0]]).then(function (r) {
      if (r[0]) setMain(r[0].path);
    });
  });
  view.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.id === "picBox") {
      e.preventDefault();
      A["pick-main"](e.target, e);
    }
  });

  /* ---- save ---- */
  function clientCheck(d) {
    var er = {};
    if (!String(d.name).trim()) er.name = "The room name is required.";
    if (d.size === "" || +d.size < 8)
      er.size = "Enter the size in square metres.";
    if (d.guests === "" || +d.guests < 1)
      er.guests = "Enter how many guests it sleeps.";
    if (!String(d.bed).trim()) er.bed = "The bed type is required.";
    if (d.price === "" || +d.price < 100)
      er.price = "Enter the price per night.";
    if (d.status === "published") {
      if (!d.image) er.image = "Add a main picture before publishing.";
      if (!String(d.short).trim())
        er.short = "Add a short description before publishing.";
    }
    return er;
  }
  function showErrors(er) {
    S.edit.errors = er;
    $$(".fl.is-bad").forEach(function (f) {
      f.classList.remove("is-bad");
    });
    var first = null;
    Object.keys(er).forEach(function (k) {
      var fl = $('.fl[data-key="' + k + '"]');
      if (!fl) return;
      fl.classList.add("is-bad");
      var s = $(".err", fl);
      if (s) s.textContent = er[k];
      if (!first) first = fl;
    });
    if (first) {
      first.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "center",
      });
      var inp = $("input,textarea", first);
      if (inp)
        setTimeout(function () {
          inp.focus({ preventScroll: true });
        }, 350);
    }
  }
  A.save = function () {
    var e = S.edit,
      btn = $("#saveBtn"),
      d = clone(e.draft);
    var er = clientCheck(d);
    if (Object.keys(er).length) {
      showErrors(er);
      toast("Please fix the highlighted fields", "err");
      return;
    }
    ["size", "guests", "inventory", "price"].forEach(function (k) {
      d[k] = num(d[k]);
    });
    d.extraBed.price = num(d.extraBed.price) || 0;
    ["festive", "winter", "summer", "monsoon"].forEach(function (k) {
      d.seasonal[k] = num(d.seasonal[k]);
    });
    busy(btn, true);
    call("save", { room: d, originalId: e.orig ? e.orig.id : null })
      .then(function (res) {
        var room = res.room,
          i = S.rooms.findIndex(function (r) {
            return e.orig && r.id === e.orig.id;
          });
        if (i > -1) S.rooms[i] = room;
        else S.rooms.push(room);
        sortRooms();
        S.saved = true;
        updateNav();
        var wasNew = !e.orig;
        S.edit = {
          orig: clone(room),
          draft: clone(room),
          errors: {},
          dirty: false,
          idTouched: true,
          routeId: room.id,
        };
        ["festive", "winter", "summer", "monsoon"].forEach(function (k) {
          if (S.edit.draft.seasonal[k] == null) S.edit.draft.seasonal[k] = "";
        });
        S.edit.snap = JSON.stringify(S.edit.draft);
        toast(
          room.name +
            (wasNew ? " was added" : " was saved") +
            (room.status === "published" ? " and is live" : " as a draft"),
        );
        history.replaceState(
          null,
          "",
          "#/rooms/edit/" + encodeURIComponent(room.id),
        );
        S.cur = location.hash;
        renderEdit();
      })
      .catch(function (err) {
        busy(btn, false);
        if (err.data && err.data.errors) {
          showErrors(err.data.errors);
          toast(err.message, "err");
        } else if (err.message !== "signed-out") toast(err.message, "err");
      });
  };
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && S.edit) {
      e.preventDefault();
      A.save();
    }
    if (
      e.key === "/" &&
      !/input|textarea|select/i.test(e.target.tagName) &&
      $("#q")
    ) {
      e.preventDefault();
      $("#q").focus();
    }
  });

  /* ======================================================================
     MEDIA LIBRARY + UPLOAD
     ====================================================================== */
  var MAXB = 6 * 1024 * 1024;
  function uploadFiles(files, onEach) {
    var out = [];
    return Array.prototype.slice
      .call(files)
      .reduce(function (p, f) {
        return p.then(function () {
          if (!/^image\/(jpeg|png|webp|avif)$/.test(f.type)) {
            toast(f.name + ": use a JPG, PNG, WebP or AVIF picture", "err");
            return;
          }
          if (f.size > MAXB) {
            toast(f.name + " is larger than 6 MB", "err");
            return;
          }
          if (onEach) onEach("start", f);
          var fd = new FormData();
          fd.append("file", f);
          return call("upload", fd)
            .then(function (r) {
              out.push(r);
              if (onEach) onEach("done", f, r);
            })
            .catch(function (e) {
              toast(f.name + ": " + e.message, "err");
              if (onEach) onEach("fail", f);
            });
        });
      }, Promise.resolve())
      .then(function () {
        return out;
      });
  }
  function openMedia(o) {
    var sel = (o.selected || []).filter(Boolean),
      items = [];
    var m = modal(
      '<div class="mdl__h"><h2>' +
        esc(o.title) +
        '</h2><button class="icon-btn" data-close aria-label="Close">' +
        ic("x") +
        '</button></div><div class="mdl__b">' +
        '<label class="drop" id="drop"><span class="ico">' +
        ic("upload") +
        '</span><b>Drop pictures here or click to upload</b><span>JPG, PNG, WebP or AVIF, up to 6 MB each</span><input type="file" id="fileIn" accept="image/jpeg,image/png,image/webp,image/avif" ' +
        (o.multiple ? "multiple" : "") +
        " hidden></label>" +
        '<div class="lib" id="lib"><div class="lib__up"><i></i><small>Loading</small></div></div></div>' +
        '<div class="mdl__f"><span style="margin-right:auto;align-self:center;font-size:13.5px;color:var(--rts-para)" id="selN"></span><button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--ink" id="useBtn">Use ' +
        (o.multiple ? "selected" : "this picture") +
        "</button></div>",
      { large: true },
    );
    var lib = $("#lib", m.el),
      drop = $("#drop", m.el),
      fi = $("#fileIn", m.el),
      useBtn = $("#useBtn", m.el);
    function draw() {
      lib.innerHTML =
        items
          .map(function (it) {
            return (
              '<button type="button" class="lib__it' +
              (sel.indexOf(it.path) > -1 ? " is-on" : "") +
              '" data-p="' +
              esc(it.path) +
              '" title="' +
              esc(it.name) +
              '"><img src="' +
              esc(img(it.path)) +
              '" alt="" loading="lazy"><span>' +
              esc(it.name) +
              "</span></button>"
            );
          })
          .join("") ||
        '<p style="grid-column:1/-1;text-align:center;padding:20px">No pictures yet. Upload your first one above.</p>';
      $("#selN", m.el).textContent = sel.length ? sel.length + " selected" : "";
      useBtn.disabled = !sel.length;
    }
    lib.addEventListener("click", function (e) {
      var b = e.target.closest(".lib__it");
      if (!b) return;
      var p = b.getAttribute("data-p"),
        i = sel.indexOf(p);
      if (o.multiple) {
        if (i > -1) sel.splice(i, 1);
        else if (!o.limit || sel.length < o.limit) sel.push(p);
        else
          toast(
            "You can add " +
              o.limit +
              " more picture" +
              (o.limit === 1 ? "" : "s"),
            "err",
          );
      } else sel = [p];
      draw();
    });
    function add(files) {
      var holders = {};
      uploadFiles(files, function (st, f, r) {
        if (st === "start") {
          var h = document.createElement("div");
          h.className = "lib__up";
          h.innerHTML = "<i></i><small>" + esc(f.name) + "</small>";
          lib.insertBefore(h, lib.firstChild);
          holders[f.name + f.size] = h;
        } else {
          var h2 = holders[f.name + f.size];
          if (h2) h2.remove();
          if (st === "done") {
            items.unshift({ path: r.path, name: r.path.split("/").pop() });
            if (o.multiple) {
              if (!o.limit || sel.length < o.limit) sel.push(r.path);
            } else sel = [r.path];
            draw();
          }
        }
      });
    }
    fi.addEventListener("change", function () {
      if (fi.files.length) add(fi.files);
      fi.value = "";
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.add("is-over");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        drop.classList.remove("is-over");
      });
    });
    drop.addEventListener("drop", function (e) {
      if (e.dataTransfer.files.length) add(e.dataTransfer.files);
    });
    useBtn.addEventListener("click", function () {
      if (!sel.length) return;
      o.onPick(sel.slice());
      m.close(true);
    });
    call("media")
      .then(function (r) {
        items = r.media;
        draw();
      })
      .catch(function (e) {
        lib.innerHTML =
          '<p style="grid-column:1/-1">' + esc(e.message) + "</p>";
      });
    draw();
  }

  /* ======================================================================
     ACTIVITY
     ====================================================================== */
  var ACT = {
    login: ["Signed in", "user", "ok"],
    "login-failed": ["Failed sign-in attempt", "alert", "bad"],
    logout: ["Signed out", "logout", ""],
    setup: ["Admin account created", "shield", "gold"],
    "room-created": ["Room added", "plus", "gold"],
    "room-updated": ["Room updated", "edit", ""],
    "room-published": ["Room published", "eye", "ok"],
    "room-unpublished": ["Room hidden", "eye", "warn"],
    "room-deleted": ["Room deleted", "trash", "bad"],
    "room-duplicated": ["Room duplicated", "copy", ""],
    "rooms-reordered": ["Order changed", "layers", ""],
    "image-uploaded": ["Picture uploaded", "image", ""],
    "password-changed": ["Password changed", "key", "warn"],
    exported: ["Backup downloaded", "download", ""],
    imported: ["Rooms imported", "upload", "gold"],
    "reservation-edited": ["Reservation edited", "edit", ""],
    "reservation-cancelled": ["Reservation cancelled", "x", "bad"],
    "reservation-paid": ["Marked as paid", "check", "ok"],
    "reservation-refunded": ["Refund started", "rupee", "warn"],
    "coupon-created": ["Coupon created", "plus", "gold"],
    "coupon-updated": ["Coupon updated", "edit", ""],
    "coupon-on": ["Coupon switched on", "eye", "ok"],
    "coupon-off": ["Coupon switched off", "eye", "warn"],
    "coupon-deleted": ["Coupon deleted", "trash", "bad"],
  };
  function viewActivity() {
    S.edit = null;
    setHead(
      "Activity",
      "History",
      '<button class="btn btn--ghost" data-act="refresh-act">' +
        ic("refresh") +
        "<span>Refresh</span></button>",
    );
    drawActivity();
    call("activity")
      .then(function (r) {
        S.activity = r.activity;
        if (parse().name === "activity") drawActivity();
      })
      .catch(function () {});
  }
  function drawActivity() {
    view.innerHTML =
      '<div class="card"><div class="card__h"><span class="ico">' +
      ic("clock") +
      '</span><div><h2>Recent activity</h2><p>The latest sign-ins and changes. Newest first.</p></div></div><div class="card__b">' +
      (S.activity.length
        ? '<div class="tl">' +
          S.activity
            .map(function (a, i) {
              var m = ACT[a.action] || [a.action, "info", ""];
              var tone = m[2] ? " tl__dot--" + m[2] : "";
              return (
                '<div class="tl__it" style="--i:' +
                Math.min(i, 14) +
                '"><span class="tl__dot' +
                tone +
                '">' +
                ic(m[1]) +
                '</span><div class="tl__t"><b>' +
                esc(m[0]) +
                "</b><span>" +
                esc(a.detail || "") +
                ' <em style="font-style:normal;opacity:.7">· ' +
                esc(a.user) +
                '</em></span></div><div class="tl__w">' +
                esc(ago(a.t)) +
                "<small>" +
                esc(fmtDT(a.t)) +
                "</small></div></div>"
              );
            })
            .join("") +
          "</div>"
        : '<p style="color:var(--rts-para)">Nothing yet.</p>') +
      "</div></div>";
  }
  A["refresh-act"] = function (t) {
    busy(t, true);
    call("activity")
      .then(function (r) {
        S.activity = r.activity;
        drawActivity();
        toast("Activity refreshed");
      })
      .catch(function (e) {
        toast(e.message, "err");
      })
      .then(function () {
        busy(t, false);
      });
  };

  /* ======================================================================
     BACKUP + WEBSITE LINK
     ====================================================================== */
  function viewBackup() {
    S.edit = null;
    setHead("Backup & website link", "Data", "");
    var pub = S.rooms.filter(function (r) {
        return r.status === "published";
      }).length,
      feed = location.origin + S.api;
    view.innerHTML =
      '<div class="two"><div class="stack">' +
      '<div class="card"><div class="card__h"><span class="ico">' +
      ic("download") +
      '</span><div><h2>Download a backup</h2><p>A single file with every room and its details.</p></div></div><div class="card__b"><p style="color:var(--rts-para);margin-bottom:16px">Keep a copy before big changes, or to move your rooms to another server. Pictures are not inside the file, only their names.</p><a class="btn btn--ink" href="api.php?a=export" download>' +
      ic("download") +
      "<span>Download rooms (.json)</span></a></div></div>" +
      '<div class="card"><div class="card__h"><span class="ico">' +
      ic("upload") +
      '</span><div><h2>Restore from a backup</h2><p>Bring rooms back from a downloaded file.</p></div></div><div class="card__b"><label class="drop" id="impDrop"><span class="ico">' +
      ic("upload") +
      '</span><b>Choose a backup file</b><span>The .json file you downloaded here</span><input type="file" id="impFile" accept="application/json,.json" hidden></label></div></div>' +
      '</div><div class="stack">' +
      '<div class="card"><div class="card__h"><span class="ico">' +
      ic("link") +
      '</span><div><h2>Website link</h2><p>How your website can read these rooms.</p></div></div><div class="card__b">' +
      '<div class="note note--blue" style="margin-bottom:16px">' +
      ic("info") +
      "<div>Your <b>Rooms page</b> currently shows its own built-in list. The feed below is ready: <b>" +
      pub +
      " published room" +
      (pub === 1 ? "" : "s") +
      "</b> are served from it right now. Connecting the page to the feed makes every edit here go live automatically.</div></div>" +
      '<div class="fl"><span class="lbl">Public feed address</span><div class="copy"><code id="feedUrl">' +
      esc(feed) +
      '</code><button type="button" data-act="copy-feed">' +
      ic("copy") +
      "<span>Copy</span></button></div></div>" +
      '<pre class="code"><span class="c">// example: load the published rooms</span>\nfetch(\'api/rooms.php\')\n  .then(r =&gt; r.json())\n  .then(d =&gt; console.log(d.rooms));</pre>' +
      '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn--ghost btn--sm" href="' +
      esc(S.api) +
      '" target="_blank" rel="noopener">' +
      ic("code") +
      '<span>Open the feed</span></a><a class="btn btn--ghost btn--sm" href="' +
      esc(S.site) +
      '" target="_blank" rel="noopener">' +
      ic("ext") +
      "<span>Open the Rooms page</span></a></div>" +
      "</div></div></div></div>";
    var f = $("#impFile");
    f.addEventListener("change", function () {
      if (f.files[0]) importFile(f.files[0]);
      f.value = "";
    });
    var dr = $("#impDrop");
    ["dragenter", "dragover"].forEach(function (ev) {
      dr.addEventListener(ev, function (e) {
        e.preventDefault();
        dr.classList.add("is-over");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dr.addEventListener(ev, function (e) {
        e.preventDefault();
        dr.classList.remove("is-over");
      });
    });
    dr.addEventListener("drop", function (e) {
      if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]);
    });
  }
  A["copy-feed"] = function (t) {
    var txt = $("#feedUrl").textContent;
    (navigator.clipboard
      ? navigator.clipboard.writeText(txt)
      : Promise.reject()
    ).then(
      function () {
        toast("Address copied");
      },
      function () {
        var r = document.createRange();
        r.selectNode($("#feedUrl"));
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        toast("Press Ctrl+C to copy");
      },
    );
  };
  function importFile(file) {
    if (file.size > 1500000) {
      toast("That file is too large to be a rooms backup", "err");
      return;
    }
    var rd = new FileReader();
    rd.onload = function () {
      var data;
      try {
        data = JSON.parse(rd.result);
      } catch (e) {
        toast("That file is not a valid backup", "err");
        return;
      }
      var rooms = Array.isArray(data) ? data : data.rooms;
      if (!Array.isArray(rooms) || !rooms.length) {
        toast("No rooms were found in that file", "err");
        return;
      }
      var m = modal(
        '<div class="mdl__h"><h2>Restore ' +
          rooms.length +
          " room" +
          (rooms.length === 1 ? "" : "s") +
          '?</h2></div><div class="mdl__b"><p>Found: <b>' +
          esc(
            rooms
              .slice(0, 6)
              .map(function (r) {
                return r.name || r.id;
              })
              .join(", "),
          ) +
          (rooms.length > 6 ? " and " + (rooms.length - 6) + " more" : "") +
          '</b></p><div class="opts">' +
          '<label class="opt"><input type="radio" name="mode" value="merge" checked><span><b>Merge with my rooms</b><small>Adds new rooms and updates rooms with the same web address. Nothing else is touched.</small></span></label>' +
          '<label class="opt"><input type="radio" name="mode" value="replace"><span><b>Replace everything</b><small>Your current list is replaced by the file. Use this to fully restore a backup.</small></span></label></div></div>' +
          '<div class="mdl__f"><button class="btn btn--ghost" data-close>Cancel</button><button class="btn btn--ink" id="goImp" data-autofocus>Restore rooms</button></div>',
      );
      $("#goImp", m.el).addEventListener("click", function (ev) {
        var mode = $("input[name=mode]:checked", m.el).value,
          b = ev.currentTarget;
        busy(b, true);
        call("import", { rooms: rooms, mode: mode })
          .then(function (r) {
            S.rooms = r.rooms;
            S.saved = true;
            updateNav();
            m.close(true);
            toast("Rooms restored");
          })
          .catch(function (e) {
            busy(b, false);
            toast(e.message, "err", 7000);
          });
      });
    };
    rd.readAsText(file);
  }

  /* ======================================================================
     ACCOUNT
     ====================================================================== */
  function viewAccount() {
    S.edit = null;
    setHead("My account", "Security", "");
    view.innerHTML =
      '<div class="two"><div class="card"><div class="card__h"><span class="ico">' +
      ic("key") +
      '</span><div><h2>Change password</h2><p>Use a long password you do not use anywhere else.</p></div></div><div class="card__b"><form id="pwForm" class="stack" novalidate>' +
      '<div class="fl" data-key="current"><label for="pw0"><span>Current password</span></label><input class="in" id="pw0" type="password" autocomplete="current-password" required><span class="err"></span></div>' +
      '<div class="fl" data-key="next"><label for="pw1"><span>New password</span><small>at least ' +
      S.minPassword +
      ' characters</small></label><input class="in" id="pw1" type="password" autocomplete="new-password" required><span class="err"></span></div>' +
      '<div class="meter" id="mt" data-s="0" style="margin:-6px 0 0"><i></i><i></i><i></i><i></i></div>' +
      '<div class="fl" data-key="again"><label for="pw2"><span>Repeat new password</span></label><input class="in" id="pw2" type="password" autocomplete="new-password" required><span class="err"></span></div>' +
      '<div><button type="submit" class="btn btn--ink" id="pwBtn">' +
      ic("check") +
      '<span>Update password</span><i class="btn__spin"></i></button></div></form></div></div>' +
      '<div class="stack"><div class="card"><div class="card__h"><span class="ico">' +
      ic("user") +
      '</span><div><h2>Signed in as</h2><p>Your administrator account.</p></div></div><div class="card__b"><dl class="kv"><dt>Name</dt><dd>' +
      esc(S.user.name) +
      "</dd><dt>Username</dt><dd>" +
      esc(S.user.username) +
      "</dd></dl></div></div>" +
      '<div class="card"><div class="card__h"><span class="ico">' +
      ic("shield") +
      '</span><div><h2>How your account is protected</h2><p>Built in, nothing to set up.</p></div></div><div class="card__b"><ul class="checks"><li>' +
      ic("check") +
      "Passwords are stored as one-way hashes, never as plain text.</li><li>" +
      ic("check") +
      "After " +
      5 +
      " wrong passwords sign-in pauses for 15 minutes.</li><li>" +
      ic("check") +
      "You are signed out after " +
      Math.round(S.idle / 60) +
      " minutes without activity.</li><li>" +
      ic("check") +
      "Every change is checked with a private security token.</li><li>" +
      ic("check") +
      "Uploaded pictures are checked and renamed. Scripts can never run from the uploads folder.</li></ul></div></div></div></div>";
    var p1 = $("#pw1");
    p1.addEventListener("input", function () {
      var v = p1.value,
        s = 0;
      if (v.length >= S.minPassword) s++;
      if (v.length >= 14) s++;
      if (/[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v)) s++;
      if (/[^A-Za-z0-9]/.test(v) || v.length >= 18) s++;
      if (v.length < S.minPassword) s = v.length ? 1 : 0;
      $("#mt").setAttribute("data-s", s);
    });
    $("#pwForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var a = $("#pw0").value,
        b = $("#pw1").value,
        c = $("#pw2").value,
        er = {};
      if (!a) er.current = "Enter your current password.";
      if (b.length < S.minPassword)
        er.next = "Use at least " + S.minPassword + " characters.";
      if (b !== c) er.again = "The two passwords do not match.";
      $$("#pwForm .fl").forEach(function (f) {
        var k = f.getAttribute("data-key");
        f.classList.toggle("is-bad", !!er[k]);
        $(".err", f).textContent = er[k] || "";
      });
      if (Object.keys(er).length) return;
      var btn = $("#pwBtn");
      busy(btn, true);
      call("password", { current: a, next: b })
        .then(function (r) {
          S.csrf = r.csrf;
          $("meta[name=csrf]").content = r.csrf;
          toast("Password updated");
          $("#pwForm").reset();
          $("#mt").setAttribute("data-s", 0);
        })
        .catch(function (err) {
          if (err.data && err.data.errors)
            $$("#pwForm .fl").forEach(function (f) {
              var m = err.data.errors[f.getAttribute("data-key")];
              f.classList.toggle("is-bad", !!m);
              $(".err", f).textContent = m ? err.message : "";
            });
          toast(err.message, "err");
        })
        .then(function () {
          busy(btn, false);
        });
    });
  }

  /* ======================================================================
     EVENTS + START
     ====================================================================== */
  view.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]");
    if (!t || !view.contains(t)) return;
    var h = A[t.getAttribute("data-act")];
    if (h) {
      if (t.tagName === "A") e.preventDefault();
      h(t, e);
    }
  });
  $("#topActions").addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]");
    if (t && A[t.getAttribute("data-act")]) A[t.getAttribute("data-act")](t, e);
  });
  $("#burger").addEventListener("click", function () {
    $("#ad").classList.toggle("is-open");
  });
  $("#scrim").addEventListener("click", function () {
    $("#ad").classList.remove("is-open");
  });
  $("#nav").addEventListener("click", function () {
    $("#ad").classList.remove("is-open");
  });

  /* the tools admin-bookings.js needs (it draws the Reservations and Coupons screens) */
  window.UchAdmin = { call: call, toast: toast, modal: modal, confirmBox: confirmBox, busy: busy, setHead: setHead, esc: esc, ic: ic, inr: inr, view: view, S: S, A: A, debounce: debounce };

  call("bootstrap")
    .then(function (r) {
      S.csrf = r.csrf;
      S.user = r.user;
      S.rooms = r.rooms;
      S.activity = r.activity;
      S.api = r.api;
      S.site = r.site;
      S.saved = r.saved;
      S.minPassword = r.minPassword;
      S.idle = r.idle;
      sortRooms();
      updateNav();
      S.cur = location.hash;
      route();
    })
    .catch(function (e) {
      if (e.message === "signed-out") return;
      view.innerHTML =
        '<div class="empty"><span class="ico">' +
        ic("alert") +
        "</span><h3>Could not load your rooms</h3><p>" +
        esc(e.message) +
        '</p><button class="btn btn--ink" data-act="reload">Try again</button></div>';
    });
})();
