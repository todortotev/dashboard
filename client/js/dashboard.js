;(function($, window, document, undefined) {

    'use strict';

    var pluginName = 'dashboard',
        defaults = {
            grid: {
                disableResize: true,
                cellHeight: 300,
                verticalMargin: 20,
                acceptWidgets: '.grid-stack-item'
            },
            viewports: {
                viewport_1: { stack: 1, range: { from: 0, to: 600 } },
                viewport_2: { stack: 2, range: { from: 600, to: 1200 } },
                viewport_3: { stack: 4, range: { from: 1200, to: 1500 } },
                viewport_4: { stack: 5, range: { from: 1500, to: 9999 } }
            },
            apiUrl: null,
            cellWidth: 300,
            throttleInterval: 100
        };

    function Plugin ( element, options ) {
        this.element = element;
        //use this in the functions etc..
        //if nothing is passed upon widget initialization defaults are used...
        this.settings = $.extend({}, defaults, options );
        //refference what the defaults were..
        this._defaults = defaults;
        //data is fetched?
        this._hasConfig = false;
        this._configurations = {};
        //after init props..
        this._currentViewport = null;
        //current gridster instance
        this._grid = null;
        this._editMode = false;

        this.init();
    }

    $.extend( Plugin.prototype, {

        init: function() {

            var self = this;
            var profile = new self.profile({ apiUrl: self.settings.apiUrl });

            self.buildGridLayout();
            self.buildAvailableWidgetsMenu();
            self.initEditMode();
            self.initStyles();

            if (!self.settings.apiUrl) {
                throw new Error('Undefined API URL');
            }

            $.get(self.settings.apiUrl + 'availableWidgets', function (data) {
                self.populateAvailableWidgetsMenu(data.widgets);
            })

            var profile = new self.profile({ apiUrl: self.settings.apiUrl });

            profile.check().done(function (check) {

                if (check.login) {
                    profile.show('logout');
                    $.notify('Logged in', 'info');
                } else {
                    profile.show('login');
                    $.notify('Not Logged in', 'info');
                }

                $.get(self.settings.apiUrl + 'default', function (response) {
                    self._configurations = response;
                    self.initProperGridForViewport();
                    $.notify('Default Configuration', 'info');
                    self.listenForResolutionChange();
                    self.checkHash();
                });

            });

        },

        profile: function (settings) {

            var $profileLogIn = $('#profileLogIn').click(function(){ return login(true); });
            var $profileLogOut = $('#profileLogOut').click(function(){ return login(false); });

            function check(){

                return $.get(settings.apiUrl + 'profile/check');

            }

            function show(target){

                if (target === 'login') {
                    $profileLogOut.hide();
                    $profileLogIn.show();
                } else {
                    $profileLogIn.hide();
                    $profileLogOut.show();
                }

            }

            function login(type){

                var type = type ? 'in' : 'out';

                $.post(settings.apiUrl + 'profile/log' + type, {}, function (response) {
                    if (response.login) {
                        show('logout');
                        $.notify('Login', 'success');
                    } else {
                        show('login');
                        $.notify('Logout', 'success');
                    }
                });

                return false;

            }
            
            return {
                check: check,
                show: show
            };

        },

        checkHash: function () {

            var hash = window.location.hash;

            if (hash === '') {
                return;
            }

            $(hash + '_widget').mouseup();
            $.notify('Auto Open Widget', 'success');

        },

        initEditMode: function () {

            var self = this;
            var $addWidget = $('.panel-add');

            $('#editMode').change(function () {

                var notified = false;

                self._editMode = $(this).is(':checked');

                $.each(self._configurations, function() {

                    if (self._editMode) {
                        self.$gridLayout.addClass('edit-mode');
                        $addWidget.show();
                        if (!notified) {
                            $.notify('Edit Mode is ON', 'success');
                            notified = true;
                        }
                    } else {
                        self.$gridLayout.removeClass('edit-mode');
                        $addWidget.hide();
                        if (!notified) {
                            $.notify('Edit Mode is OFF', 'success');
                            notified = true;
                        }
                    }

                    $.each(this.widgets, function (idx, widget) {
                        self._grid.locked(widget.$widget, widget.locked);
                        self._grid.movable(widget.$widget, !widget.locked);
                    });

                });

                notified = false;

            });
            
            $.notify('Edit Mode is OFF', 'info');

        },

        initStyles: function () {

            var themes = '/css/themes/';
            var fonts = { 1: 'Raleway', 2: 'Oswald', 3: 'Indie+Flower' };
            var fontsUrl = 'https://fonts.googleapis.com/css?family=';

            $('.theme').change(function () {
                $('#theme').attr('href', themes + 'theme_' + this.value + '.css');
                $('#font').attr('href', fontsUrl + fonts[this.value]);
                $.notify('Theme Changed', 'success');
            });

            $('.background').change(function () {

                var value = parseInt(this.value);
                var background = 'none';

                if (value > 0) {
                    background = 'url(' + themes + 'backgrounds/background_' + value + '.jpg)';
                }

                $('body').css('background-image', background);
                $.notify('Background Changed', 'success');

            });

            $.notify('Default Theme', 'info');
            $.notify('Default Background', 'info');

        },

        buildGridLayout: function () {
            
            $.notify.defaults({ position: 'right middle', autoHideDelay: 10000 });

            this.$gridLayout = $('<div>').appendTo($(this.element));

            this.$gridRoot = $('<div class="widget-root">').appendTo(this.$gridLayout);

        },

        populateAvailableWidgetsMenu: function (widgets) {
            var self = this;
            widgets.forEach(function (widget) {
                var widgetInfo = $('<li>');
                widgetInfo.addClass('widget-info ');

                widgetInfo.draggable({
                    stop: function (e, ui) {
                    
                        var $el = $('#KORR');
                        $el.removeClass('widget-clone')
                    }, 
                    start: function (e, ui) {
                        $(this).height(widget.height * 300);
                        $(this).width(widget.width * 300);
                        $(this).attr('id','KORR')
                        $(this).removeClass('widget-info');
                        $(this).addClass('widget-clone grid-stack-item');
                        $(this).append($(ui.helper).clone());
                    }
                });
                self.$availableWidgetsMenu.append(widgetInfo);
            })
        },

        buildAvailableWidgetsMenu: function () {
            var self = this;
            var $menu = $('<ul>');
            $menu.attr('id','available-widgets-menu');
            self.$availableWidgetsMenu = $menu;

            var $menuWrapper = $('<div>');
            $menuWrapper.attr('id','available-widgets-menu-wrapper');

            var $menuButton = $('<div/>');
            $menuButton.attr('id','available-widgets-menu-btn');
            $menuButton.click(function () {
                $(this).toggleClass('open');
                $menuWrapper.toggle();
            })


            $menuWrapper.append($menu);
            this.$gridLayout.prepend($menuWrapper);
            this.$gridLayout.append($menuButton);
        },

        createWidgetElement: function (widgetSettings) {
            var self = this;
            var id = widgetSettings.id;
            var width = widgetSettings.width * self.settings.cellWidth;
            var $wrapper = $('<div>');
            var $iframe = $('<iframe src="' + self.settings.apiUrl + 'widgets/' + id + '" id="widget_' + id + '" name="widget_' + id + '" scrolling="no"></iframe>')
            var $hover = $('<div id="' + widgetSettings.url + '_widget" class="widget-hover">').mouseup(function () {

                if (self._editMode) {
                    return;
                }

                if (widgetSettings.settings) {
                    alert('Open Widget Settigs Dialog: ' + self.settings.apiUrl + 'settings/' + id);
                }

                alert('Call App ID: ' + id);

                window.location.hash = widgetSettings.url;

            });
            var $title = $('<div class="widget-title">' + widgetSettings.name + '</div>');
            var $close = $('<div class="widget-remove">remove</div>').click(function () {

                alert('Remove Widget ID:' + id);

                window.location.hash = '';

            });
            
            if (widgetSettings.refresh) {
                widgetSettings.refresh = setInterval(function () {
                    $iframe.attr('src', $iframe.attr('src'));
                }, widgetSettings.refresh * 1000);
            }

            $('<div class="grid-stack-item-content">')
                .append($iframe)
                .append($hover)
                .append($title)
                .append($close)
                .appendTo($wrapper);                        

            return $wrapper;
        },

        setGridConfiguration: function (config) {
            var self = this;

             $.each(config.widgets, function (idx, widget) {

                   var $wrapper = self.createWidgetElement(widget);                     

                    self._grid.addWidget($wrapper, widget.x, widget.y, widget.width, widget.height);
                    widget.$widget = $wrapper;
                    
                    self._grid.movable($wrapper, false);

                });
        },

        initProperGridForViewport: function () {
            var self = this;
            var width = $(window).width();

            var properViewport = Object.keys(self.settings.viewports).filter(function (key) {
                var vp = self.settings.viewports[key];
                return width > vp.range.from && width <= vp.range.to
            });

            var viewportConfig = self.settings.viewports[properViewport];

            //dont reinit current
            if (self._currentViewport && viewportConfig.stack === self._currentViewport.stack) return;

            self._currentViewport = viewportConfig;

            //if currently set grid => remove it
            if (self._grid) self._grid.destroy();

            //rm children
            self.$gridRoot.empty();

            var properGridSettings = self.settings.grid;
            //important to set this in order to prevent overlapping.
            properGridSettings.width = self._currentViewport.stack;

            self.$grid =
                    $('<div class="grid-stack grid-stack-' + self._currentViewport.stack + '">')
                        .appendTo(self.$gridRoot)
                        .gridstack(properGridSettings);

            self._grid = this.$grid.data('gridstack');

            self.setGridConfiguration(self._configurations[properViewport]);
        },

        listenForResolutionChange: function () {

            var self = this;
            $(window).resize(_.throttle(self.initProperGridForViewport.bind(self), self.settings.throttleInterval));
        }

    });

    $.fn[pluginName] = function (options) {
        return this.each(function () {
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName, new Plugin(this, options));
            }
        });
    };

})(jQuery, window, document);
