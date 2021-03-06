@(item: model.MetaData)(implicit request: RequestHeader)
@import conf.Switches._
@import conf.Static
@import conf.Configuration

@JavaScript(Static.js.systemJsSetupFragment)

 // Bracket notation for IE8 (import is reserved)
System['import']('core').then(function () {
    return System['import']('domready');
}).then(function (domready) {
    domready(function () {
        System['import']('raven').then(function (raven) {
            raven.config(
                'http://' + guardian.config.page.sentryPublicApiKey + '@@' + guardian.config.page.sentryHost,
                {
                    whitelistUrls: [
                        /localhost/, @* will not actually log errors, but `shouldSendCallback` will be called *@
                        /assets\.guim\.co\.uk/,
                        /ophan\.co\.uk/
                    ],
                    tags: {
                        edition:        guardian.config.page.edition,
                        contentType:    guardian.config.page.contentType,
                        revisionNumber: guardian.config.page.revisionNumber,
                        loaderType:     'SystemJs'
                    },
                    dataCallback: function(data) {
                        if (data.culprit) {
                            data.culprit = data.culprit.replace(/\/[a-z\d]{32}(\/[^\/]+)$/, '$1');
                        }
                        data.tags.origin = (/j.ophan.co.uk/.test(data.culprit)) ? 'ophan' : 'app';
                        return data;
                    },
                    shouldSendCallback: function(data) {
                        @if(play.Play.isDev()) {
                            // Some environments don't support or don't always expose the console object
                            if (window.console && window.console.warn) {
                                console.warn('Raven captured error.', data);
                            }
                        }
                        return @conf.Switches.DiagnosticsLogging.isSwitchedOn &&
                            Math.random() < 0.2 &&
                            @{!play.Play.isDev()}; @* don't actually notify sentry in dev mode*@
                    }
                }
            );

            // Report uncaught exceptions
            raven.install();

            // Report unhandled promise rejections
            // https://github.com/cujojs/when/blob/master/docs/debug-api.md#browser-window-events
            window.addEventListener('unhandledRejection', function (event) {
                raven.captureException(event.detail.reason);
            });

            // Safe to depend on Lodash because it's part of core
            System['import']('common/utils/_').then(function (_) {
                var importAll = function (moduleIds) {
                    return Promise.all(_(moduleIds)
                        .map(function(module){ return System['import'](module); })
                        .value());
                };
                importAll([
                    'common/utils/config',
                    'common/modules/experiments/ab',
                    'common/modules/ui/images',
                    'common/modules/ui/lazy-load-images']).then(function(values) {
                    var config = values[0];
                    var ab = values[1];
                    var images = values[2];
                    var lazyLoadImages = values[3];
                    ab.segmentUser();
                    ab.run();
                    if(guardian.config.page.isFront) {
                        if(!document.addEventListener) { // IE8 and below
                            window.onload = images.upgradePictures;
                        }
                    }
                    lazyLoadImages.init();
                    images.upgradePictures();
                    images.listen();
                    if (config.switches.commercial && !config.page.isPreferencesPage) {
                        System['import']('bootstraps/commercial').then(raven.wrap(
                            { tags: { feature: 'commercial' } },
                            function (commercial) {
                                commercial.init();
                            }
                        ));
                    }
                    if (guardian.isModernBrowser) {
                        @if(play.Play.isDev()) {
                            System['import']('bootstraps/dev').then(function (devmode) { devmode.init(); });
                        }
                        System['import']('bootstraps/app').then(function(app) {
                            app.go();
                        });
                    }
                    @if(item.section == "crosswords") {
                        System['import']('es6/bootstraps/crosswords').then(function (crosswords) {
                            crosswords.default.init();
                        });
                    }
                });
            });
            @JavaScript(templates.headerInlineJS.js.membershipAccess(item).body)
        });
    });
});

