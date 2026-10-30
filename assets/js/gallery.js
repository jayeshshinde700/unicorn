/**
 * Unicon Hospitality — Gallery Page Script
 * Scoped IIFE: Tab filtering, accessible lightbox, video modal, and interactions.
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        initCategoryFilter();
        initLightbox();
        initAutoplayVideo();
        initSmoothScroll();
    });

    /**
     * 1. Category Filtering
     */
    function initCategoryFilter() {
        var filterButtons = document.querySelectorAll('.gl-filter-btn');
        var galleryItems = document.querySelectorAll('.gl-item');

        if (!filterButtons.length || !galleryItems.length) return;

        // Count categories dynamically
        var counts = {
            all: galleryItems.length,
            rooms: 0,
            dining: 0,
            pool: 0,
            architecture: 0
        };

        galleryItems.forEach(function (item) {
            var cat = item.getAttribute('data-category');
            if (counts[cat] !== undefined) {
                counts[cat]++;
            }
        });

        // Set counts into badge elements
        filterButtons.forEach(function (btn) {
            var filter = btn.getAttribute('data-filter');
            var countEl = btn.querySelector('.gl-count');
            if (countEl && counts[filter] !== undefined) {
                countEl.textContent = counts[filter];
            }

            btn.addEventListener('click', function () {
                filterButtons.forEach(function (b) {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');

                applyFilter(filter);
            });
        });

        function applyFilter(category) {
            galleryItems.forEach(function (item) {
                var itemCat = item.getAttribute('data-category');
                if (category === 'all' || itemCat === category) {
                    item.classList.remove('gl-hidden');
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.96)';
                    setTimeout(function () {
                        item.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                    }, 20);
                } else {
                    item.classList.add('gl-hidden');
                }
            });
        }
    }

    /**
     * 2. Lightbox Modal
     */
    function initLightbox() {
        var lightbox = document.getElementById('glLightbox');
        if (!lightbox) return;

        var imgEl = lightbox.querySelector('.gl-lightbox__img');
        var titleEl = lightbox.querySelector('.gl-lightbox__title');
        var captionEl = lightbox.querySelector('.gl-lightbox__caption');
        var counterEl = lightbox.querySelector('.gl-lightbox__counter');
        var ctaEl = lightbox.querySelector('.gl-lightbox__cta');
        var closeBtn = lightbox.querySelector('.gl-lightbox__close');
        var prevBtn = lightbox.querySelector('.gl-lightbox__prev');
        var nextBtn = lightbox.querySelector('.gl-lightbox__next');

        var currentIndex = 0;
        var activeItems = [];
        var lastFocusedElement = null;

        function getVisibleItems() {
            var allItems = Array.prototype.slice.call(document.querySelectorAll('.gl-item'));
            return allItems.filter(function (item) {
                return !item.classList.contains('gl-hidden');
            });
        }

        function updateLightboxView() {
            if (!activeItems.length || currentIndex < 0 || currentIndex >= activeItems.length) return;
            var currentItem = activeItems[currentIndex];
            var src = currentItem.getAttribute('data-lightbox-src') || (currentItem.querySelector('img') ? currentItem.querySelector('img').src : '');
            var title = currentItem.getAttribute('data-title') || '';
            var caption = currentItem.getAttribute('data-caption') || '';
            var ctaLink = currentItem.getAttribute('data-cta-link') || '';
            var ctaText = currentItem.getAttribute('data-cta-text') || '';

            if (imgEl) {
                imgEl.style.opacity = '0.3';
                imgEl.src = src;
                imgEl.alt = title;
                imgEl.onload = function () {
                    imgEl.style.opacity = '1';
                };
            }

            if (titleEl) titleEl.textContent = title;
            if (captionEl) captionEl.textContent = caption;
            if (counterEl) counterEl.textContent = 'Image ' + (currentIndex + 1) + ' of ' + activeItems.length;

            if (ctaEl) {
                if (ctaLink && ctaText) {
                    ctaEl.href = ctaLink;
                    ctaEl.textContent = ctaText;
                    ctaEl.style.display = 'inline-flex';
                } else {
                    ctaEl.style.display = 'none';
                }
            }
        }

        function openLightbox(index) {
            lastFocusedElement = document.activeElement;
            activeItems = getVisibleItems();
            currentIndex = index;
            updateLightboxView();
            lightbox.classList.add('is-open');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            if (closeBtn) closeBtn.focus();
        }

        function closeLightbox() {
            lightbox.classList.remove('is-open');
            lightbox.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            if (lastFocusedElement) {
                lastFocusedElement.focus();
            }
        }

        function nextItem() {
            if (!activeItems.length) return;
            currentIndex = (currentIndex + 1) % activeItems.length;
            updateLightboxView();
        }

        function prevItem() {
            if (!activeItems.length) return;
            currentIndex = (currentIndex - 1 + activeItems.length) % activeItems.length;
            updateLightboxView();
        }

        // Delegate click on gallery items
        var galleryGrid = document.querySelector('.gl-grid');
        if (galleryGrid) {
            galleryGrid.addEventListener('click', function (e) {
                var card = e.target.closest('.gl-item');
                if (!card) return;

                // If user specifically clicked a link CTA inside card, let them follow the link
                if (e.target.closest('.gl-card__action')) return;

                activeItems = getVisibleItems();
                var index = activeItems.indexOf(card);
                if (index !== -1) {
                    openLightbox(index);
                }
            });

            // Keyboard accessibility for items
            galleryGrid.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    var card = e.target.closest('.gl-item');
                    if (card) {
                        e.preventDefault();
                        activeItems = getVisibleItems();
                        var index = activeItems.indexOf(card);
                        if (index !== -1) {
                            openLightbox(index);
                        }
                    }
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', closeLightbox);
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', nextItem);
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', prevItem);
        }

        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox || e.target.classList.contains('gl-lightbox__stage')) {
                closeLightbox();
            }
        });

        document.addEventListener('keydown', function (e) {
            if (!lightbox.classList.contains('is-open')) return;

            if (e.key === 'Escape') {
                closeLightbox();
            } else if (e.key === 'ArrowRight') {
                nextItem();
            } else if (e.key === 'ArrowLeft') {
                prevItem();
            }
        });
    }

    /**
     * 3. Autoplay Inline Video with Viewport Detection & Controls
     */
    function initAutoplayVideo() {
        var video = document.getElementById('glInlineVideo');
        var container = document.getElementById('glVideoPlayerContainer');
        var playPauseBtn = document.getElementById('glPlayPauseBtn');
        var playLabel = document.getElementById('glPlayLabel');
        var icoPlay = document.querySelector('.gl-ico-play');
        var icoPause = document.querySelector('.gl-ico-pause');
        var soundBtn = document.getElementById('glSoundBtn');
        var soundLabel = document.getElementById('glSoundLabel');
        var icoMuted = document.querySelector('.gl-ico-muted');
        var icoUnmuted = document.querySelector('.gl-ico-unmuted');
        var fsBtn = document.getElementById('glFullscreenBtn');

        if (!video || !container) return;

        var userPaused = false;

        function updatePlayState(isPlaying) {
            if (!playLabel || !icoPlay || !icoPause) return;
            if (isPlaying) {
                icoPlay.style.display = 'none';
                icoPause.style.display = 'block';
                playLabel.textContent = 'Pause';
                if (playPauseBtn) playPauseBtn.setAttribute('aria-label', 'Pause video');
            } else {
                icoPlay.style.display = 'block';
                icoPause.style.display = 'none';
                playLabel.textContent = 'Play';
                if (playPauseBtn) playPauseBtn.setAttribute('aria-label', 'Play video');
            }
        }

        // Auto-play when scrolled down into view using IntersectionObserver
        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        if (!userPaused) {
                            var promise = video.play();
                            if (promise !== undefined) {
                                promise.then(function () {
                                    updatePlayState(true);
                                }).catch(function () {});
                            }
                        }
                    } else {
                        video.pause();
                        updatePlayState(false);
                    }
                });
            }, { threshold: 0.35 });

            observer.observe(container);
        } else {
            video.play().catch(function () {});
        }

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (video.paused) {
                    userPaused = false;
                    video.play().then(function () {
                        updatePlayState(true);
                    }).catch(function () {});
                } else {
                    userPaused = true;
                    video.pause();
                    updatePlayState(false);
                }
            });
        }

        if (soundBtn) {
            soundBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                video.muted = !video.muted;
                if (video.muted) {
                    if (icoMuted) icoMuted.style.display = 'block';
                    if (icoUnmuted) icoUnmuted.style.display = 'none';
                    if (soundLabel) soundLabel.textContent = 'Unmute';
                    soundBtn.setAttribute('aria-label', 'Unmute audio');
                } else {
                    if (icoMuted) icoMuted.style.display = 'none';
                    if (icoUnmuted) icoUnmuted.style.display = 'block';
                    if (soundLabel) soundLabel.textContent = 'Mute';
                    soundBtn.setAttribute('aria-label', 'Mute audio');
                }
            });
        }

        if (fsBtn) {
            fsBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (!document.fullscreenElement) {
                    if (container.requestFullscreen) {
                        container.requestFullscreen();
                    } else if (video.webkitEnterFullscreen) {
                        video.webkitEnterFullscreen();
                    }
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    }
                }
            });
        }

        // Clicking anywhere on the video container toggles play/pause
        container.addEventListener('click', function (e) {
            if (e.target.closest('.gl-video-controls')) return;
            if (video.paused) {
                userPaused = false;
                video.play().then(function () {
                    updatePlayState(true);
                }).catch(function () {});
            } else {
                userPaused = true;
                video.pause();
                updatePlayState(false);
            }
        });
    }

    /**
     * 4. Quick filter chips & smooth scroll
     */
    function initSmoothScroll() {
        var anchorLinks = document.querySelectorAll('.gl-hchip[href^="#"], .gl-hero__cta');
        anchorLinks.forEach(function (link) {
            link.addEventListener('click', function (e) {
                var targetId = link.getAttribute('href');
                if (targetId && targetId.startsWith('#')) {
                    var target = document.querySelector(targetId);
                    if (target) {
                        e.preventDefault();
                        var offset = 90;
                        var bodyRect = document.body.getBoundingClientRect().top;
                        var targetRect = target.getBoundingClientRect().top;
                        var targetPosition = targetRect - bodyRect - offset;
                        window.scrollTo({
                            top: targetPosition,
                            behavior: 'smooth'
                        });
                    }
                }
            });
        });

        var quickChips = document.querySelectorAll('.gl-hchip[data-quick-filter]');
        quickChips.forEach(function (chip) {
            chip.addEventListener('click', function () {
                var category = chip.getAttribute('data-quick-filter');
                var matchingBtn = document.querySelector('.gl-filter-btn[data-filter="' + category + '"]');
                if (matchingBtn) {
                    matchingBtn.click();
                }
                var target = document.getElementById('glFilterSection');
                if (target) {
                    var offset = 80;
                    var bodyRect = document.body.getBoundingClientRect().top;
                    var targetRect = target.getBoundingClientRect().top;
                    var targetPosition = targetRect - bodyRect - offset;
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }
})();
