/* CloudCarousel
 *
 * Original work Copyright (c) 2011 by R Cecco. <http://www.professorcloud.com/>
 * Modified work Copyright (c) 2014 Kevin Ott <supercodingmonkey@gmail.com>
 *
 * The MIT License (MIT)
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Reflection code based on plugin by Christophe Beyls <http://www.digitalia.be/>
 */

(function($) {
    /**
     * Helper Object to create reflection under an image
     * @param {type} img
     * @param {type} reflHeight
     * @param {type} opacity
     */
    function Reflection(img, reflHeight, opacity) {
        var reflection, cntx, gradient, parent;
        var imageWidth = parseInt(img.width, 10),
            imageHeight = parseInt(img.height, 10);

        parent = $(img.parentNode);
        this.element = reflection = parent.append("<canvas class='reflection' style='position:absolute'/>").find(':last')[0];
        if (!reflection.getContext && $.browser.msie) {
            this.element = reflection = parent.append("<img class='reflection' style='position:absolute'/>").find(':last')[0];
            reflection.src = img.src;
            reflection.style.filter = "flipv progid:DXImageTransform.Microsoft.Alpha(opacity=" + (opacity * 100) + ", style=1, finishOpacity=0, startx=0, starty=0, finishx=0, finishy=" + (reflHeight / imageHeight * 100) + ")";

        } else {
            cntx = reflection.getContext("2d");
            try {
                $(reflection).attr({
                    width: imageWidth + "px",
                    height: reflHeight + "px"
                });
                cntx.save();
                cntx.translate(0, imageHeight - 1);
                cntx.scale(1, -1);
                cntx.drawImage(img, 0, 0, imageWidth, imageHeight);
                cntx.restore();
                cntx.globalCompositeOperation = "destination-out";
                gradient = cntx.createLinearGradient(0, 0, 0, reflHeight);
                gradient.addColorStop(0, "rgba(255, 255, 255, " + (1 - opacity) + ")");
                gradient.addColorStop(1, "rgba(255, 255, 255, 1.0)");
                cntx.fillStyle = gradient;
                cntx.fillRect(0, 0, imageWidth, reflHeight);
            } catch (e) {
                return;
            }
        }
        // Store a copy of the alt and title attrs into the reflection
        $(reflection).attr({
            alt: $(img).attr('alt'),
            title: $(img).attr('title')
        });
    }

    /**
     * Wrapper Object for items in the carousel
     * @param {type} imgIn
     * @param {type} options
     * @returns {_L11.Item}
     */
    var Item = function(imgIn, options)
    {
        this.orgWidth = imgIn.width;
        this.orgHeight = imgIn.height;
        this.image = imgIn;
        this.reflection = null;
        this.alt = imgIn.alt;
        this.title = imgIn.title;
        this.imageOK = false;
        this.options = options;
        this.imageOK = true;

        if (this.options.reflHeight > 0) {
            this.reflection = new Reflection(this.image, this.options.reflHeight, this.options.reflOpacity);
        }
        $(this.image).css('position', 'absolute');	// Bizarre. This seems to reset image width to 0 on webkit!
    };

    /**
     * Controller Object for controlling any interaction with the carousel
     * @param {type} container
     * @param {type} images
     * @param {type} options
     * @returns {_L11.Controller}
     */
    var Controller = function(container, images, options) {
        var items = [],
            funcSin = Math.sin,
            funcCos = Math.cos,
            ctx = this;
        var cWidth = parseInt($(container).width(), 10),
            cHeight = parseInt(container.style.height, 10);
        this.stopped = false;
        //this.imagesLoaded = 0;
        this.container = container;
        this.xRadius = options.xRadius;
        this.yRadius = options.yRadius;
        this.showFrontTextTimer = 0;
        this.autoRotateTimer = 0;
        if (options.xRadius === 0) {
            this.xRadius = cWidth / 2.3;
        }
        if (options.yRadius === 0) {
            this.yRadius = cHeight / 6;
        }
        this.xCentre = cWidth / 2;
        this.yCentre = cHeight / 6;
        this.frontIndex = 0;	// Index of the item at the front

        // Start with the first item at the front.
        this.rotation = this.destRotation = Math.PI / 2;

        // Whether or not an autorotation has been done (prevents duplicate autorotate calls)
        this.autoRotated = false;

        // Get the requestAnimationFrame() that's available
        var reqFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                       window.webkitRequestAnimationFrame || window.msRequestAnimationFrame ||
                       function() {
                           // TODO: Provide setInterval polyfill
                       };

        // Turn on the infoBox (Should probably be assumed to be visible)
        if (options.altBox !== null) {
            $(options.altBox).css('display', 'block');
        }
        if (options.titleBox !== null) {
            $(options.titleBox).css('display', 'block');
        }
        var $container = $(container);
        // Turn on relative position for container to allow absolutely positioned elements
        // within it to work.
        $container.css({
            position: 'relative',
            overflow: 'hidden'
       });

        // Setup the buttons.
        $(options.buttonLeft).bind('mouseup', this, function(event) {
            event.data.rotate(-1);
            event.data.resetRotate();
            return false;
        });
        $(options.buttonRight).bind('mouseup', this, function(event) {
            event.data.rotate(1);
            event.data.resetRotate();
            return false;
        });

        // You will need this plugin for the mousewheel to work: http://plugins.jquery.com/project/mousewheel
        if (options.mouseWheel) {
            $container.bind('mousewheel', this, function(event, delta) {
                event.data.rotate(delta);
                return false;
            });
        }
        $container.bind('click', this, function(event) {
            clearInterval(event.data.autoRotateTimer); // Stop auto rotation if mouse over.
            var text = $(event.target).attr('alt');
            // If we have moved over a carousel item, then show the alt and title text.

            if (text !== undefined && text !== null) {
                clearTimeout(event.data.showFrontTextTimer);
                $(options.altBox).html(($(event.target).attr('alt')));
                $(options.titleBox).html(($(event.target).attr('title')));
                if (options.bringToFront && event.type === 'click') {
                    var idx = $(event.target).data('itemIndex');
                    var frontIndex = event.data.frontIndex;
                    //var	diff = idx - frontIndex;
                    var diff = (idx - frontIndex) % images.length;
                    if (Math.abs(diff) > images.length / 2) {
                        diff += (diff > 0 ? -images.length : images.length);
                    }
                    event.data.rotate(-diff);
                }
            }
        });

        $container.bind('mouseover', this, function(event) {
            var context = event.data;
            context.stopRotateTimer();
        });

        // If we have moved out of a carousel item (or the container itself),
        // restore the text of the front item in 1 second.
        $container.bind('mouseout', this, function(event) {
            var context = event.data;
            clearTimeout(context.showFrontTextTimer);
            context.showFrontTextTimer = setTimeout(function() {
                context.showFrontText();
            }, 1000);
            context.resetRotate();
        });

        // Prevent items from being selected as mouse is moved and clicked in the container.
        $container.bind('mousedown', this, function(event) {
            event.data.container.focus();
            return false;
        });
        container.onselectstart = function() {
            return false;
        };		// For IE.

        this.innerWrapper = $container.wrapInner('<div style="position:absolute;width:100%;height:100%;"/>').children()[0];

        // Shows the text from the front most item.
        this.showFrontText = function() {
            var currentItemIndex = (this.frontIndex + items.length) % items.length;
            // Ignore unloaded items
            if (items[ currentItemIndex ] === undefined) {
                return;
            }
            $(options.titleBox).html($(items[ currentItemIndex ].image).attr('title'));
            $(options.altBox).html($(items[ currentItemIndex ].image).attr('alt'));
        };

        this.go = function() {
            this.pauseUpdate = false;
        };

        this.stop = function() {
            this.pauseUpdate = true;
        };

        // Starts the rotation of the carousel. Direction is the number (+-) of carousel items to rotate by.
        this.rotate = function(direction) {
            this.frontIndex = (this.frontIndex - direction) % items.length;
            this.destRotation += (Math.PI / items.length) * (2 * direction);
            this.showFrontText();
            this.go();
        };

        this.autoRotate = function() {
            if (options.autoRotate !== 'no') {
                var dir = (options.autoRotate === 'right') ? 1 : -1;
                this.autoRotateTimer = setInterval(function() {
                    if(ctx.autoRotated) {
                        return;
                    }
                    ctx.autoRotated = true;
                    ctx.rotate(dir);
                }, options.autoRotateDelay);
            }
        };

        this.resetRotate = function() {
            clearTimeout(this.autoRotateTimer);
            this.autoRotate();
        };

        this.stopRotateTimer = function() {
            clearTimeout(this.autoRotateTimer);
        };

        this.updateTick = function(curTime) {
            reqFrame(this.updateTick.bind(this));
            // Don't animate when paused or when there's not going to be a change
            if (this.pauseUpdate || this.destRotation == this.rotation) {
                return;
            }
            var minScale = options.minScale;    // This is the smallest scale applied to the furthest item.
            var smallRange = (1 - minScale) * 0.5;
            var w, h, x, y, scale, item, sinVal;

            var change = (this.destRotation - this.rotation);
            var absChange = Math.abs(change);

            this.rotation += change * options.speed;
            // If this is the case, the rotation to an item is complete
            if (absChange < 0.001) {
                this.rotation = this.destRotation;
                // Reset the autoRotation check
                this.autoRotated = false;
            }
            var itemsLen = items.length;
            var spacing = (Math.PI / itemsLen) * 2;
            //var   wrapStyle = null;
            var radians = this.rotation;
            var isMSIE = $.browser.msie;

            // Turn off display. This can reduce repaints/reflows when making style and position changes in the loop.
            // See http://dev.opera.com/articles/view/efficient-javascript/?page=3
            this.innerWrapper.style.display = 'none';

            var style,
                reflHeight;
            var context = this;
            for (var i = 0; i < itemsLen; i++) {
                item = items[i];

                sinVal = funcSin(radians);

                scale = ((sinVal + 1) * smallRange) + minScale;

                x = Math.round(this.xCentre + (((funcCos(radians) * this.xRadius) - (item.orgWidth * 0.5)) * scale));
                y = Math.round(this.yCentre + (((sinVal * this.yRadius)) * scale));

                if (item.imageOK) {
                    var img = item.image;
                    w = Math.round(item.orgWidth * scale);
                    h = Math.round(item.orgHeight * scale);
                    img.style.width = w + "px";
                    img.style.height = h + "px";
                    img.style.left = x + "px";
                    img.style.top = y + "px";
                    img.style.zIndex = Math.floor(scale * 100); // z-index must be an int
                    if (item.reflection !== null) {
                        reflHeight = Math.round(options.reflHeight * scale);
                        style = item.reflection.element.style;
                        style.left = x + "px";
                        style.top = y + h + Math.round(options.reflGap * scale) + "px";
                        style.width = w + "px";
                        if (isMSIE) {
                            style.filter.finishy = (reflHeight / h * 100);
                        } else {
                            style.height = reflHeight + "px";
                        }
                    }
                }
                radians += spacing;
            }
            // Turn display back on.
            this.innerWrapper.style.display = 'block';
        };

        // Check if images have loaded. We need valid widths and heights for the reflections.
        this.checkImagesLoaded = function() {
            var i;
            for (i = 0; i < images.length; i++) {
                if ((images[i].width === undefined) || ((images[i].complete !== undefined) && (!images[i].complete))) {
                    return;
                }
            }
            for (i = 0; i < images.length; i++) {
                items.push(new Item(images[i], options));
                $(images[i]).data('itemIndex', i);
            }
            // If all images have valid widths and heights, we can stop checking.
            clearInterval(this.tt);
            this.showFrontText();
            this.autoRotate();
            this.go();
            reqFrame(this.updateTick.bind(this));
        };

        this.tt = setInterval(function() {
            ctx.checkImagesLoaded();
        }, 50);
    };

    // The jQuery plugin part. Iterates through items specified in selector and inits a Controller class for each one.
    $.fn.CloudCarousel = function(options) {
        this.each(function() {
            options = $.extend({}, {
                reflHeight: 0,
                reflOpacity: 0.5,
                reflGap: 0,
                minScale: 0.5,
                xPos: 0,
                yPos: 0,
                xRadius: 0,
                yRadius: 0,
                altBox: null,
                titleBox: null,
                autoRotate: 'no',
                autoRotateDelay: 1500,
                speed: 0.2,
                mouseWheel: false,
                bringToFront: false
            }, options);
            // Create a Controller for each carousel.
            $(this).data('cloudcarousel', new Controller(this, $('.cloudcarousel', $(this)), options));
        });
        return this;
    };
})(jQuery);
