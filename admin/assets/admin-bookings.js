/* Unicorn Hospitality - Admin Studio: RESERVATIONS and COUPONS screens.
   admin.js loads first and hands us its tools in window.UchAdmin (server call, toast, modal, confirm box ...).
   The server side of every call here is admin/includes/bookings-admin.php.

   Where to change things:
     - columns / filters of the reservation list ........ viewReservations() and rowHtml()
     - what you can do with one reservation ............. openReservation() (the pop-up)
     - the coupon form ................................... openCouponForm()
     - wording of payment / status labels ................ PAY_LABEL and STATUS_LABEL just below */
(function () {
  "use strict";
  var K = window.UchAdmin;
  if (!K) return;
  var esc = K.esc, ic = K.ic, call = K.call, toast = K.toast, view = K.view, busy = K.busy;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtD(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? m[3] + " " + MONTHS[+m[2] - 1] + " " + m[1] : "-"; }
  function fmtDT(s) { var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(s || ""); return m ? m[3] + " " + MONTHS[+m[2] - 1] + " " + m[1] + ", " + m[4] + ":" + m[5] : "-"; }
  function rs(n) { return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }); }

  var STATUS_LABEL = {
    confirmed: ["Confirmed", "badge--ok"], awaiting: ["Awaiting payment", "badge--gold"],
    cancelled: ["Cancelled", "badge--draft"], abandoned: ["Abandoned", "badge--draft"]
  };
  function payLabel(r) {
    if (r.paymentStatus === "refunded") return ["Refunded", "badge--draft"];
    if (r.paymentStatus === "partial_refund") return ["Part refunded", "badge--gold"];
    if (r.paymentStatus === "refund_failed") return ["Refund failed", "bk-bad"];
    if (r.paymentStatus === "paid") return [r.paymentMethod === "manual" ? "Paid (manual)" : r.paymentMethod === "free" ? "Free (coupon)" : "Paid online", "badge--ok"];
    if (r.status === "confirmed") return ["Unpaid (pay at hotel)", "bk-bad"];
    return ["Not paid", "badge--draft"];
  }
  function badge(pair) { return '<span class="badge ' + pair[1] + '"><i></i>' + esc(pair[0]) + "</span>"; }

  var R = { filter: "active", q: "", list: [], stats: null };

  /* ======================================================================
     RESERVATIONS - list
     ====================================================================== */
  function viewReservations() {
    K.setHead("Reservations", "Bookings",
      '<a class="btn btn--ghost" href="api.php?a=reservations_export">' + ic("download") + "<span>Download CSV</span></a>" +
      '<button class="btn btn--ink" id="bkRefresh">' + ic("refresh") + "<span>Refresh</span></button>");
    $("#bkRefresh").addEventListener("click", function () { loadReservations(true); });
    view.innerHTML =
      '<div class="stats" id="bkStats"></div><div id="bkNote"></div>' +
      '<div class="bar"><div class="search">' + ic("search") + '<input type="search" id="bkQ" placeholder="Search name, booking ID, e-mail, phone" value="' + esc(R.q) + '" aria-label="Search reservations"></div>' +
      '<div class="chips" id="bkChips">' + [["active", "All"], ["upcoming", "Upcoming"], ["arrivals", "Arrivals today"], ["awaiting", "Awaiting payment"], ["cancelled", "Cancelled"], ["abandoned", "Abandoned"], ["attention", "Needs attention"]]
        .map(function (c) { return '<button type="button" class="chip" data-v="' + c[0] + '" aria-pressed="' + (R.filter === c[0]) + '">' + c[1] + "</button>"; }).join("") +
      '</div><span class="bar__count" id="bkCount"></span></div><div class="bk-table" id="bkRows"><div class="skel"><i></i><i></i><i></i></div></div>';
    $("#bkQ").addEventListener("input", K.debounce(function (e) { R.q = e.target.value; loadReservations(); }, 250));
    $("#bkChips").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      R.filter = b.getAttribute("data-v");
      $$("#bkChips .chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c === b)); });
      loadReservations();
    });
    $("#bkRows").addEventListener("click", function (e) {
      var row = e.target.closest("[data-id]"); if (row) openReservation(row.getAttribute("data-id"));
    });
    drawStats();
    loadReservations();
  }

  function loadReservations(announce) {
    var st = R.filter === "active" ? "all" : R.filter;
    call("reservations&status=" + encodeURIComponent(st) + "&q=" + encodeURIComponent(R.q.trim()))
      .then(function (r) {
        R.list = r.reservations; R.stats = r.stats;
        if (!$("#bkRows")) return;
        drawStats(); drawRows();
        if (announce) toast("Reservations refreshed");
      })
      .catch(function (e) { if ($("#bkRows")) $("#bkRows").innerHTML = '<div class="empty"><h3>Could not load reservations</h3><p>' + esc(e.message) + "</p></div>"; });
  }

  function drawStats() {
    var s = R.stats || { upcoming: 0, arrivals: 0, awaiting: 0, attention: 0, revenueMonth: 0 };
    var box = function (i, label, val, sub, cls) { return '<div class="stat ' + (cls || "") + '" style="--i:' + i + '"><small>' + label + "</small><b>" + val + "</b><span>" + sub + "</span></div>"; };
    var el = $("#bkStats"); if (!el) return;
    el.innerHTML = box(0, "Upcoming stays", s.upcoming, "confirmed and paid", "stat--ink") + box(1, "Arrivals today", s.arrivals, "checking in today") +
      box(2, "Awaiting payment", s.awaiting, "guests paying right now") + box(3, "Revenue this month", rs(s.revenueMonth), "online payments, after refunds");
    var n = $("#bkNote");
    n.innerHTML = s.attention ? '<div class="note" style="margin-bottom:16px">' + ic("alert") + "<div><b>" + s.attention + " reservation" + (s.attention > 1 ? "s need" : " needs") + " attention.</b> Confirmed but unpaid, or a refund that failed. <a href=\"#\" id=\"bkAttn\">Show them</a></div></div>" : "";
    var a = $("#bkAttn"); if (a) a.addEventListener("click", function (e) { e.preventDefault(); R.filter = "attention"; viewReservations(); });
    var pill = $("#navResCount"); if (pill) { pill.hidden = !s.arrivals; pill.textContent = s.arrivals; pill.title = "Arrivals today"; }
  }

  function rowHtml(r) {
    return '<button type="button" class="bk-row" data-id="' + esc(r.id) + '">' +
      '<span class="bk-c bk-id"><b>' + esc(r.id) + "</b><small>Booked " + esc(fmtDT(r.createdAt)) + "</small></span>" +
      '<span class="bk-c"><b>' + esc(r.firstName + " " + r.lastName) + "</b><small>" + esc(r.email) + "</small></span>" +
      '<span class="bk-c"><b>' + esc(r.room) + "</b><small>" + r.adults + " adult" + (r.adults > 1 ? "s" : "") + (r.children ? ", " + r.children + " child" : "") + "</small></span>" +
      '<span class="bk-c"><b>' + esc(fmtD(r.checkIn)) + "</b><small>to " + esc(fmtD(r.checkOut)) + " (" + r.nights + "N)</small></span>" +
      '<span class="bk-c"><b>' + rs(r.total) + "</b><small>" + (r.coupon ? "Coupon " + esc(r.coupon) : "&nbsp;") + "</small></span>" +
      '<span class="bk-c">' + badge(STATUS_LABEL[r.status] || [r.status, "badge--draft"]) + "<small>" + badge(payLabel(r)) + "</small></span></button>";
  }
  function drawRows() {
    var el = $("#bkRows");
    $("#bkCount").textContent = R.list.length + (R.list.length === 1 ? " reservation" : " reservations");
    el.innerHTML = R.list.length
      ? '<div class="bk-head"><span>Booking</span><span>Guest</span><span>Room</span><span>Stay</span><span>Total</span><span>Status</span></div>' + R.list.map(rowHtml).join("")
      : '<div class="empty"><span class="ico">' + ic("people") + "</span><h3>No reservations here</h3><p>Bookings appear here as soon as a guest pays on the website.</p></div>";
  }

  /* ======================================================================
     RESERVATIONS - one reservation (pop-up)
     ====================================================================== */
  var EVENT_TEXT = {
    created: "Booking started", confirmed: "Reservation confirmed", "payment-received": "Payment received", "payment-failed": "Payment attempt failed", "payment-error": "Payment could not start",
    edited: "Edited", modified: "Changed by guest", cancelled: "Cancelled", refunded: "Refund started", "refund-failed": "Refund failed", "refund-done": "Refund completed",
    "marked-paid": "Marked as paid", "sold-out": "Sold out after payment", "amount-mismatch": "Amount mismatch", "bad-signature": "Payment check failed",
    "email-sent": "E-mail sent", "email-failed": "E-mail failed", "email-disabled": "E-mail switched off"
  };

  function openReservation(id) {
    var m = K.modal('<div class="mdl__h"><h2>Reservation ' + esc(id) + '</h2></div><div class="mdl__b"><div class="skel"><i></i><i></i></div></div>', { large: true });
    call("reservation&id=" + encodeURIComponent(id)).then(function (d) { drawReservation(m, d.reservation, d.events); })
      .catch(function (e) { m.close(); toast(e.message, "err"); });
  }

  function opt(v, cur, label) { return '<option value="' + v + '"' + (String(v) === String(cur) ? " selected" : "") + ">" + label + "</option>"; }
  function field(label, name, val, type, extra) {
    return '<div class="fl" data-key="' + name + '"><label for="bk_' + name + '"><span>' + label + '</span></label><input class="in" id="bk_' + name + '" name="' + name + '" type="' + (type || "text") + '" value="' + esc(val == null ? "" : val) + '" ' + (extra || "") + '><span class="err"></span></div>';
  }

  function drawReservation(m, r, events) {
    var pay = payLabel(r), live = r.status === "confirmed" || r.status === "awaiting";
    var canRefund = r.paymentMethod === "razorpay" && r.paymentId && (r.paidAmount - r.refunded) > 0.009;
    var codes = { "+91": "India +91", "+1": "USA +1", "+44": "UK +44", "+971": "UAE +971", "+65": "Singapore +65", "+61": "Australia +61" };
    var html =
      '<div class="mdl__h"><h2>' + esc(r.id) + '</h2><div class="bk-badges">' + badge(STATUS_LABEL[r.status] || [r.status, "badge--draft"]) + badge(pay) + "</div></div>" +
      '<div class="mdl__b bk-detail"><div class="bk-detail__main"><form id="bkForm" novalidate>' +
      '<h3 class="bk-h">Guest</h3><div class="grid2">' + field("First name", "firstName", r.firstName) + field("Last name", "lastName", r.lastName) + "</div>" +
      '<div class="grid2">' + field("E-mail", "email", r.email, "email") +
      '<div class="fl" data-key="phone"><label for="bk_phone"><span>Phone</span></label><div style="display:flex;gap:8px"><select class="in" name="phoneCountry" style="max-width:130px">' +
      Object.keys(codes).map(function (c) { return opt(c, r.phoneCountry, codes[c]); }).join("") + '</select><input class="in" id="bk_phone" name="phone" value="' + esc(r.phone) + '"></div><span class="err"></span></div></div>' +
      '<h3 class="bk-h">Stay <small>' + esc(r.room) + " at " + rs(r.pricePerNight) + " per night</small></h3>" +
      '<div class="grid2">' + field("Check-in", "checkIn", r.checkIn, "date") + field("Check-out", "checkOut", r.checkOut, "date") + "</div>" +
      '<div class="grid2">' + field("Adults", "adults", r.adults, "number", 'min="1" max="12"') + field("Children", "children", r.children, "number", 'min="0" max="10"') + "</div>" +
      '<div class="fl"><label for="bk_req"><span>Guest\'s special requests</span></label><textarea class="in" id="bk_req" name="specialRequests" rows="2" maxlength="500">' + esc(r.requests) + "</textarea></div>" +
      '<div class="fl"><label for="bk_notes"><span>Internal notes</span><small>only you see this</small></label><textarea class="in" id="bk_notes" name="adminNotes" rows="3" maxlength="2000" placeholder="e.g. Called guest, early check-in approved">' + esc(r.notes) + "</textarea></div>" +
      '<label class="bk-check"><input type="checkbox" name="notifyGuest"> E-mail the guest that their booking was changed</label>' +
      '<div class="bk-actions"><button type="submit" class="btn btn--gold" id="bkSave">' + ic("save") + "<span>Save changes</span><i class=\"btn__spin\"></i></button></div></form></div>" +

      '<aside class="bk-detail__side"><div class="bk-box"><h3 class="bk-h">Money</h3><dl class="kv">' +
      "<dt>Room charges</dt><dd>" + rs(r.subtotal) + "</dd>" + (r.discount ? "<dt>Coupon " + esc(r.coupon) + "</dt><dd>- " + rs(r.discount) + "</dd>" : "") +
      (r.taxAmount ? "<dt>Taxes</dt><dd>" + rs(r.taxAmount) + "</dd>" : "") + "<dt><b>Total</b></dt><dd><b>" + rs(r.total) + "</b></dd>" +
      (r.paidAmount !== null ? "<dt>Paid</dt><dd>" + rs(r.paidAmount) + (r.paidAt ? "<br><small>" + esc(fmtDT(r.paidAt)) + "</small>" : "") + "</dd>" : "") +
      (r.refunded ? "<dt>Refunded</dt><dd>" + rs(r.refunded) + "</dd>" : "") +
      (r.paymentId ? "<dt>Payment ID</dt><dd><code>" + esc(r.paymentId) + "</code></dd>" : "") + (r.orderId ? "<dt>Order ID</dt><dd><code>" + esc(r.orderId) + "</code></dd>" : "") +
      "<dt>Guest e-mail</dt><dd>" + esc(r.emailStatus) + "</dd></dl></div>" +
      '<div class="bk-box"><h3 class="bk-h">Actions</h3><div class="bk-btns">' +
      (live && r.paymentStatus !== "paid" ? '<button class="btn btn--ink btn--sm" data-do="paid">' + ic("check") + "<span>Mark as paid</span></button>" : "") +
      (canRefund ? '<button class="btn btn--ghost btn--sm" data-do="refund">' + ic("rupee") + "<span>Refund</span></button>" : "") +
      (r.status !== "awaiting" ? '<button class="btn btn--ghost btn--sm" data-do="resend">' + ic("link") + "<span>Resend e-mail</span></button>" : "") +
      (live ? '<button class="btn btn--danger btn--sm" data-do="cancel">' + ic("x") + "<span>Cancel reservation</span></button>" : "") +
      "</div>" + (r.paymentStatus === "refund_failed" ? '<p class="bk-warn">The automatic refund failed. Refund it from the Razorpay dashboard (payment ' + esc(r.paymentId) + ").</p>" : "") + "</div>" +
      '<div class="bk-box"><h3 class="bk-h">History</h3><div class="bk-tl" id="bkTl"></div></div></aside></div>' +
      '<div class="mdl__f"><button class="btn btn--ghost" data-close>Close</button></div>';
    m.el.querySelector(".mdl__box").innerHTML = html;
    $$("[data-close]", m.el).forEach(function (b) { b.addEventListener("click", function () { m.close(); }); });
    drawEvents(m, events);

    function refresh(d) { m.el.querySelector(".mdl__box").innerHTML = ""; drawReservation(m, d.reservation, d.events); loadReservations(); }

    $("#bkForm", m.el).addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, body = { id: r.id };
      $$("input,textarea,select", f).forEach(function (el) { if (el.name) body[el.name] = el.type === "checkbox" ? el.checked : el.value; });
      $$(".fl", f).forEach(function (x) { x.classList.remove("is-bad"); });
      var btn = $("#bkSave", m.el); busy(btn, true);
      call("reservation_save", body).then(function (d) {
        toast(d.priceChanged ? "Saved. The total changed, see History." : "Reservation saved"); refresh(d);
      }).catch(function (err) {
        var er = (err.data && err.data.errors) || {};
        Object.keys(er).forEach(function (k) { var fl = $('.fl[data-key="' + k + '"]', f); if (fl) { fl.classList.add("is-bad"); $(".err", fl).textContent = er[k]; } });
        toast(err.message, "err"); busy(btn, false);
      });
    });

    $$("[data-do]", m.el).forEach(function (b) {
      b.addEventListener("click", function () {
        var what = b.getAttribute("data-do");
        if (what === "paid") K.confirmBox({ title: "Mark as paid?", icon: "check", danger: false, ok: "Mark as paid", text: "<p>Use this when you received the money outside Razorpay (cash, bank transfer). The reservation is confirmed and the guest gets the confirmation e-mail.</p>" })
          .then(function (ok) { if (ok) act("reservation_markpaid", {}, b, "Marked as paid"); });
        if (what === "resend") act("reservation_resend", {}, b, "E-mail sent");
        if (what === "refund") openRefund(r, refresh);
        if (what === "cancel") openCancel(r, refresh);
      });
    });
    function act(action, extra, btn, okMsg) {
      busy(btn, true);
      call(action, Object.assign({ id: r.id }, extra)).then(function (d) { toast(okMsg); refresh(d); })
        .catch(function (err) { toast(err.message, "err"); busy(btn, false); if (err.data && err.data.events) drawEvents(m, err.data.events); });
    }
  }

  function drawEvents(m, events) {
    var el = $("#bkTl", m.el); if (!el) return;
    el.innerHTML = events.length ? events.map(function (e) {
      return '<div class="bk-ev"><b>' + esc(EVENT_TEXT[e.event] || e.event) + "</b><span>" + esc(e.detail) + "</span><small>" + esc(fmtDT(e.at)) + " &middot; " + esc(e.actor.replace("admin:", "admin ")) + "</small></div>";
    }).join("") : "<p>No history yet.</p>";
  }

  function openCancel(r, done) {
    var paid = r.paymentMethod === "razorpay" && r.paymentStatus === "paid";
    var m = K.modal('<div class="mdl__ico">' + ic("alert") + '</div><div class="mdl__h"><h2>Cancel ' + esc(r.id) + '?</h2></div><div class="mdl__b"><p>The room becomes available again straight away.</p>' +
      (paid ? '<label class="bk-check"><input type="checkbox" id="cxRefund" checked> Refund ' + rs(r.paidAmount - r.refunded) + " to the guest through Razorpay</label>" : "") +
      '<label class="bk-check"><input type="checkbox" id="cxMail" checked> E-mail the guest</label>' +
      '<div class="fl" style="margin-top:10px"><label for="cxWhy"><span>Reason (kept in History)</span></label><input class="in" id="cxWhy" maxlength="150"></div></div>' +
      '<div class="mdl__f"><button class="btn btn--ghost" data-close>Keep it</button><button class="btn btn--danger" id="cxGo">Cancel reservation</button></div>');
    $("#cxGo", m.el).addEventListener("click", function () {
      var b = this; busy(b, true);
      call("reservation_cancel", { id: r.id, refund: paid && $("#cxRefund").checked, notifyGuest: $("#cxMail").checked, reason: $("#cxWhy").value }).then(function (d) {
        m.close(); toast(d.refundMessage || "Reservation cancelled"); done(d);
      }).catch(function (e) { toast(e.message, "err"); busy(b, false); });
    });
  }

  function openRefund(r, done) {
    var left = Math.round((r.paidAmount - r.refunded) * 100) / 100;
    var m = K.modal('<div class="mdl__ico">' + ic("rupee") + '</div><div class="mdl__h"><h2>Refund through Razorpay</h2></div><div class="mdl__b"><p>Up to ' + rs(left) + ' can be refunded. Leave the amount as it is for a full refund. Banks take 5 to 7 working days.</p>' +
      '<div class="fl"><label for="rfAmt"><span>Amount (INR)</span></label><input class="in" id="rfAmt" type="number" step="0.01" min="1" max="' + left + '" value="' + left + '" data-autofocus></div></div>' +
      '<div class="mdl__f"><button class="btn btn--ghost" data-close>Close</button><button class="btn btn--ink" id="rfGo">Refund</button></div>');
    $("#rfGo", m.el).addEventListener("click", function () {
      var b = this; busy(b, true);
      call("reservation_refund", { id: r.id, amount: $("#rfAmt").value }).then(function (d) { m.close(); toast(d.message); done(d); })
        .catch(function (e) { toast(e.message, "err"); busy(b, false); });
    });
  }

  /* ======================================================================
     COUPONS
     ====================================================================== */
  var C = { list: [] };
  var CSTATE = { active: ["Live", "badge--ok"], scheduled: ["Starts soon", "badge--gold"], expired: ["Expired", "badge--draft"], used_up: ["Fully used", "badge--draft"], inactive: ["Switched off", "badge--draft"] };

  function viewCoupons() {
    K.setHead("Coupons", "Offers", '<button class="btn btn--gold" id="cpNew">' + ic("plus") + "<span>New coupon</span></button>");
    $("#cpNew").addEventListener("click", function () { openCouponForm(null); });
    view.innerHTML = '<div class="note note--blue" style="margin-bottom:18px">' + ic("info") + "<div><b>How coupons work.</b> Create a coupon here and it appears on the website's <b>Coupons</b> page straight away (unless you hide it). Guests type the code on the booking page. Everything is checked again on the server when they pay.</div></div><div class=\"cp-grid\" id=\"cpGrid\"><div class=\"skel\"><i></i><i></i></div></div>";
    $("#cpGrid").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cp]"); if (!b) return;
      var c = C.list.filter(function (x) { return x.id === +b.getAttribute("data-id"); })[0]; if (!c) return;
      var what = b.getAttribute("data-cp");
      if (what === "edit") openCouponForm(c);
      if (what === "copy") { try { navigator.clipboard.writeText(c.code); toast("Code " + c.code + " copied"); } catch (x) { toast(c.code); } }
      if (what === "toggle") { busy(b, true); call("coupon_toggle", { id: c.id }).then(function () { loadCoupons(); toast(c.active ? "Coupon switched off" : "Coupon switched on"); }).catch(function (er) { toast(er.message, "err"); busy(b, false); }); }
      if (what === "delete") K.confirmBox({ title: "Delete " + c.code + "?", text: "<p>The coupon disappears from the website. Past bookings keep their discount. To stop it temporarily, switch it off instead.</p>", ok: "Delete coupon" })
        .then(function (ok) { if (ok) call("coupon_delete", { id: c.id }).then(function () { toast("Coupon deleted"); loadCoupons(); }).catch(function (er) { toast(er.message, "err"); }); });
    });
    loadCoupons();
  }
  function loadCoupons() {
    call("coupons").then(function (r) { C.list = r.coupons; drawCoupons(); }).catch(function (e) { if ($("#cpGrid")) $("#cpGrid").innerHTML = '<div class="empty"><h3>Could not load coupons</h3><p>' + esc(e.message) + "</p></div>"; });
  }
  function drawCoupons() {
    var el = $("#cpGrid"); if (!el) return;
    el.innerHTML = C.list.length ? C.list.map(function (c, i) {
      var valid = c.validFrom || c.validTo ? (c.validFrom ? fmtD(c.validFrom) : "now") + " to " + (c.validTo ? fmtD(c.validTo) : "no end date") : "No end date";
      return '<article class="cp" style="--i:' + Math.min(i, 10) + '"><div class="cp__top"><code class="cp__code">' + esc(c.code) + "</code>" + badge(CSTATE[c.state] || [c.state, "badge--draft"]) + "</div>" +
        "<h3>" + esc(c.title) + '</h3><p class="cp__off">' + esc(c.headline) + "</p>" + (c.description ? '<p class="cp__d">' + esc(c.description) + "</p>" : "") +
        '<dl class="cp__meta"><dt>Used</dt><dd>' + c.used + (c.usageLimit ? " of " + c.usageLimit : "") + "</dd><dt>Book by</dt><dd>" + esc(valid) + "</dd><dt>Website</dt><dd>" + (c.public ? "Shown on Coupons page" : "Hidden (code only)") + "</dd></dl>" +
        '<div class="cp__btns"><button class="btn btn--ghost btn--sm" data-cp="edit" data-id="' + c.id + '">' + ic("edit") + "<span>Edit</span></button>" +
        '<button class="btn btn--ghost btn--sm" data-cp="copy" data-id="' + c.id + '">' + ic("copy") + "<span>Copy</span></button>" +
        '<button class="btn btn--ghost btn--sm" data-cp="toggle" data-id="' + c.id + '">' + ic("eye") + "<span>" + (c.active ? "Switch off" : "Switch on") + "</span></button>" +
        '<button class="icon-btn icon-btn--danger" data-cp="delete" data-id="' + c.id + '" aria-label="Delete ' + esc(c.code) + '">' + ic("trash") + "</button></div></article>";
    }).join("") : '<div class="empty"><span class="ico">' + ic("star") + "</span><h3>No coupons yet</h3><p>Create your first offer, for example 15% off for stays of 2 nights or more.</p></div>";
  }

  function genCode() {
    var a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
    return "STAY" + s.slice(0, 4);
  }

  function openCouponForm(c) {
    var d = c || { code: "", title: "", description: "", type: "percent", value: "", maxDiscount: "", minSubtotal: "", minNights: 1, appliesTo: "all", validFrom: "", validTo: "", stayFrom: "", stayTo: "", usageLimit: "", perEmailLimit: 1, active: true, public: true };
    var v = function (x) { return x == null ? "" : x; };
    var m = K.modal('<div class="mdl__h"><h2>' + (c ? "Edit coupon" : "New coupon") + '</h2></div><form id="cpForm" novalidate><div class="mdl__b">' +
      '<div class="grid2"><div class="fl" data-key="code"><label for="cp_code"><span>Code</span><small>what guests type</small></label><div style="display:flex;gap:8px"><input class="in" id="cp_code" name="code" value="' + esc(d.code) + '" maxlength="40" style="text-transform:uppercase" placeholder="DIWALI15"><button type="button" class="btn btn--ghost btn--sm" id="cpGen">Generate</button></div><span class="err"></span></div>' +
      field("Offer name (shown to guests)", "title", d.title, "text", 'maxlength="120" placeholder="Diwali Special"') + "</div>" +
      '<div class="fl"><label for="cp_desc"><span>Short description</span></label><input class="in" id="cp_desc" name="description" maxlength="400" value="' + esc(d.description) + '" placeholder="Celebrate the festival of lights with us"></div>' +
      '<div class="grid3"><div class="fl"><label for="cp_type"><span>Discount type</span></label><select class="in" id="cp_type" name="type">' + opt("percent", d.type, "Percentage (%)") + opt("flat", d.type, "Fixed amount (INR)") + "</select></div>" +
      field("Discount value", "value", v(d.value), "number", 'min="0" step="0.01"') + '<div id="cpMaxWrap">' + field("Maximum discount (INR)", "maxDiscount", v(d.maxDiscount), "number", 'min="0" step="1" placeholder="no cap"') + "</div></div>" +
      '<div class="grid3">' + field("Minimum booking (INR)", "minSubtotal", v(d.minSubtotal), "number", 'min="0" step="1" placeholder="none"') + field("Minimum nights", "minNights", d.minNights, "number", 'min="1" max="30"') +
      '<div class="fl"><label for="cp_ap"><span>Applies to</span></label><select class="in" id="cp_ap" name="appliesTo">' + opt("all", d.appliesTo, "Rooms and suites") + opt("room", d.appliesTo, "Rooms only") + opt("suite", d.appliesTo, "Suites only") + "</select></div></div>" +
      '<p class="bk-sub">Guests can use it when booking between</p><div class="grid2">' + field("From (optional)", "validFrom", v(d.validFrom), "date") + field("Until (optional)", "validTo", v(d.validTo), "date") + "</div>" +
      '<p class="bk-sub">Only for stays that check in between</p><div class="grid2">' + field("From (optional)", "stayFrom", v(d.stayFrom), "date") + field("Until (optional)", "stayTo", v(d.stayTo), "date") + "</div>" +
      '<div class="grid2">' + field("Total times it can be used", "usageLimit", v(d.usageLimit), "number", 'min="1" placeholder="unlimited"') + field("Times per guest (e-mail)", "perEmailLimit", d.perEmailLimit, "number", 'min="1" max="50"') + "</div>" +
      '<label class="bk-check"><input type="checkbox" name="active"' + (d.active ? " checked" : "") + '> Switched on</label>' +
      '<label class="bk-check"><input type="checkbox" name="public"' + (d.public ? " checked" : "") + '> Show on the website\'s Coupons page (untick for a private code you share yourself)</label>' +
      '</div><div class="mdl__f"><button type="button" class="btn btn--ghost" data-close>Cancel</button><button type="submit" class="btn btn--gold" id="cpSave">' + ic("save") + '<span>Save coupon</span><i class="btn__spin"></i></button></div></form>', { large: true });
    var form = $("#cpForm", m.el);
    function sync() { $("#cpMaxWrap", m.el).style.display = form.type.value === "percent" ? "" : "none"; }
    form.type.addEventListener("change", sync); sync();
    $("#cpGen", m.el).addEventListener("click", function () { form.code.value = genCode(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var o = { id: c ? c.id : 0 };
      $$("input,select", form).forEach(function (el) { if (el.name) o[el.name] = el.type === "checkbox" ? el.checked : el.value; });
      $$(".fl", form).forEach(function (x) { x.classList.remove("is-bad"); });
      var btn = $("#cpSave", m.el); busy(btn, true);
      call("coupon_save", { coupon: o }).then(function () { m.close(); toast("Coupon saved"); loadCoupons(); })
        .catch(function (err) {
          var er = (err.data && err.data.errors) || {};
          Object.keys(er).forEach(function (k) { var fl = $('.fl[data-key="' + k + '"]', form); if (fl) { fl.classList.add("is-bad"); $(".err", fl).textContent = er[k]; } });
          toast(err.message, "err"); busy(btn, false);
        });
    });
  }

  window.UchAdminExt = { reservations: viewReservations, coupons: viewCoupons };

  /* show today's arrivals in the menu from the first screen on */
  call("reservations&status=arrivals").then(function (r) { R.stats = r.stats; drawStats(); }).catch(function () {});
})();
