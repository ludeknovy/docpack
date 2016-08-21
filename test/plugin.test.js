var chai = require('chai');
var expect = require('chai').expect;
var sinon = require('sinon');

chai.should();
chai
  .use(require('sinon-chai'))
  .use(require("chai-as-promised"));

var Plugin = require('../lib/plugin');
var HOOKS = require('../lib/hooks');
var configureLoaderPath = require('../lib/configurator/loader').LOADER_PATH;
var InMemoryCompiler = require('../lib/modules/MemoryCompiler');
var mergeConfig = require('webpack-config-merger');
var Source = require('../lib/data/Source');
var createPlugin = require('../lib/utils/createPlugin');

function inMemoryCompiler(config) {
  var defaultConfig = {
    context: '/',

    output: {
      filename: '[name].js',
      path: '/build'
    }
  };

  var compiler = new InMemoryCompiler(
    mergeConfig(defaultConfig, config || {}),
    true,
    true
  );

  return compiler;
}

describe('Plugin', function () {

  describe('static props', function () {
    Plugin.should.have.property('HOOKS').and.be.a('object').and.eql(HOOKS);
  });

  describe('::extract()', function () {
    it('should exist', function () {
      Plugin.extract.should.exist.and.be.a('function');
    });

    it('should return path to configure loader', function () {
      Plugin.extract().should.contain(configureLoaderPath);
    });

    it('should return path with query params when options are presented', function () {
      var params = {qwe: 123};
      Plugin.extract({qwe: 123}).should.contain(JSON.stringify(params));
    });
  });

  describe('::createPlugin()', function () {
    it('should exist', function() {
      Plugin.createPlugin.should.exist.and.be.a('function');
    });

    it('should throw when required fields not specified', function() {
      expect(function() { Plugin.createPlugin() }).to.throw();
    });

    it('should be a factory to create plugins', function() {
      var pluginData = {
        name: 'tralala',
        defaultOptions: {foo: 'bar'},
        apply: function() {}
      };

      var plugin = Plugin.createPlugin(pluginData);
      var instance = plugin();

      instance.should.have.a.property('getName');
      instance.getName.should.be.a('function');
      instance.getName().should.eql(pluginData.name);
      instance.options.should.be.an('object').and.be.eql(pluginData.defaultOptions);
      instance.apply.should.be.an('function');
    });

    it('should allow to create instance via new operator & with function call', function() {
      var plugin = Plugin.createPlugin({name: 'qwe'});
      new plugin().should.be.instanceof(plugin);
    });

    it('should allow to create instance via function call', function() {
      var plugin = Plugin.createPlugin({name: 'qwe'});
      plugin().should.be.instanceof(plugin);
    });
  });

  describe('constructor', function () {
    it('should allow to create instance via function call', function() {
      Plugin().should.be.instanceof(Plugin);
    });

    it('should set initial config', function () {
      var plugin = new Plugin();
      plugin.should.have.property('config').and.be.an('object');
      plugin.should.have.property('extractors').and.be.an('object');
      plugin.config.should.have.property('loaders').and.be.an('array');
    });
  });

  describe('getConfig()', function () {
    it('should exist', function () {
      new Plugin().getConfig.should.exist;
    });

    it('should return initial config if no arguments specified', function () {
      var plugin = new Plugin();
      plugin.getConfig().should.eql(plugin.config.initial);
    });

    describe('when plugin instantiated', function () {
      var plugin;
      var compiler;

      beforeEach(function () {
        plugin = new Plugin();
        compiler = inMemoryCompiler({
          module: {
            loaders: [
              {test: /\.qwe$/, loader: Plugin.extract({foo: 'bar'})}
            ]
          },
          plugins: [plugin]
        });
      });

      it('should return config provided in loaders', function (done) {
        compiler.run()
          .then(function () {
            var config = plugin.getConfig('/tralala/test.qwe');
            config.should.have.property('foo');
            config.foo.should.be.eql('bar');
            done();
          })
          .catch(done);
      });

      it('should return initial config value if no param specified via loaders found', function (done) {
        compiler.run()
          .then(function () {
            var config = plugin.getConfig('/tralala');
            config.should.be.eql(plugin.config.initial);
            done();
          })
          .catch(done);
      });
    });
  });

  describe('registerExtractor()', function () {
    it('should throw if invalid extractor structure provided', function() {
      var extractor = {
        apply: function (compiler) {
          var extractor = this;

          compiler.plugin(HOOKS.CONFIGURE, function (plugin) {
            plugin.registerExtractor(extractor);
          })
        }
      };

      expect(function() {
        inMemoryCompiler({plugins: [ new Plugin(), extractor ]})
      }).to.throw();
    });

    it('should register extractor and throw when it already registered', function (done) {
      var extractorName = 'tralala';
      var extractor = {
        getName: function () { return extractorName },
        extract: function () {},
        apply: function (compiler) {
          var extractor = this;

          compiler.plugin(HOOKS.CONFIGURE, function (plugin) {
            plugin.registerExtractor(extractor);
          })
        }
      };

      var plugin = new Plugin();

      inMemoryCompiler({plugins: [plugin, extractor]}).run()
        .then(function () {
          plugin.extractors.should.have.property(extractorName).and.be.eql(extractor);

          expect(function () {
            plugin.registerExtractor({
              getName: function () {
                return 'tralala'
              },
              extract: function () {
              },
              apply: function () {
                var extractor = this;

                compiler.plugin(HOOKS.CONFIGURE, function (plugin) {
                  plugin.registerExtractor(extractor);
                })
              }
            });
          }).to.throw();

          done();
        })
        .catch(done);
    });
  });

  describe('save()', function () {
    it('should save source', function() {
      var source = new Source({path: '/qwe', absolutePath: '/qwe', content: 'qwe'});
      var plugin = new Plugin();

      plugin.save(source);
      plugin.sources.should.include(source).and.to.have.lengthOf(1);

      plugin.save(source);
      plugin.sources.should.include(source).and.to.have.lengthOf(1);
    })
  });

  describe('readFile()', function () {
    it('should use the same filesystem with compiler', function(done) {
      var file = {
        path: '/test.txt',
        content: 'qwe'
      };

      var plugin = new Plugin();
      var compiler = inMemoryCompiler({plugins: [plugin]});

      compiler.inputFileSystem.writeFileSync(file.path, file.content, 'utf-8');
      plugin.readFile(file.path)
        .then(function (content) {
          content.toString().should.eql(file.content);
          done();
        })
        .catch(done);
    })
  });

  describe('addEntry()', function () {
    it('should add entry point to compiler', function() {
    });
  });

  describe('apply()', function () {
    it('should fill `config.loaders`', function(done) {
      var plugin = new Plugin();
      var loader = {
        test: /\.qwe$/,
        include: /qwe/,
        exclude: /tralala/,
        loader: Plugin.extract({option: 1}),
        customProp: 123
      };

      inMemoryCompiler({
        module: { loaders: [loader] },
        plugins: [plugin]
      })
        .run()
        .then(function () {
          plugin.config.loaders.should.be.an('array').and.have.lengthOf(1);
          done();
        })
        .catch(done);
    });

    it('should do nothing if no files to process', function (done) {
      var spiedPluginBody = sinon.spy();
      var plugin = {
        apply: function (compiler) {
          compiler.plugin('compilation', function (compilation) {
            compilation.plugin(HOOKS.SOURCES_CREATED, spiedPluginBody);
          });
        }
      };

      inMemoryCompiler({plugins: [new Plugin, plugin]}).run()
        .then(function () {
          spiedPluginBody.should.have.not.been.called;
          done();
        })
        .catch(done);
    });

    describe('Hook: CONFIGURE', function () {
      it('should be called', function (done) {
        var spiedPluginBody = sinon.spy();
        var plugin = {
          apply: function (compiler) {
            compiler.plugin(HOOKS.CONFIGURE, spiedPluginBody);
          }
        };

        inMemoryCompiler({plugins: [new Plugin, plugin]}).run()
          .then(function () {
            spiedPluginBody.should.have.been.calledOnce;
            done();
          })
          .catch(done)
      });
    });

    describe('Hook: FILTER_SOURCES', function () {
      it('should filter sources', function(done) {
        var plugin = new Plugin();
        var filteredSources;

        var filterPlugin = {
          apply: function(compiler) {
            compiler.plugin('compilation', function(compilation) {
              compilation.plugin(HOOKS.FILTER_SOURCES, function(sources, done) {

                var filtered = sources.filter(function(source) {
                  var isEntry1 = source.content.indexOf('entry1') != -1;
                  return isEntry1;
                });

                filteredSources = filtered;
                done(null, filtered);
              });
            });
          }
        };

        var compiler = inMemoryCompiler({
          entry: ['./entry1', './entry2'],
          module: {
            loaders: [
              {
                test: /\.js$/,
                loader: Plugin.extract()
              }
            ]
          },
          plugins: [plugin, filterPlugin]
        });

        compiler.inputFileSystem.writeFileSync('/entry1.js', '/*entry1 content*/', 'utf-8');
        compiler.inputFileSystem.writeFileSync('/entry2.js', '/*entry2 content*/', 'utf-8');

        compiler.run()
          .then(function () {
            filteredSources.should.be.an('array').and.to.have.lengthOf(1);
            done();
          })
          .catch(done);
      });
    });

    describe('Extracting', function () {
      it('should reject when extractor not found', function () {
        var compiler = inMemoryCompiler({
          entry: './entry',
          module: {
            loaders: [
              {
                test: /\.js$/,
                loader: Plugin.extract({extractor: 'tralala'})
              }
            ]
          },
          plugins: [new Plugin]
        });

        compiler.inputFileSystem.writeFileSync('/entry.js', 'qwe', 'utf-8');

        return compiler.run().should.be.rejected;
      });
    });
  });
});