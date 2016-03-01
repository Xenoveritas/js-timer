module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: '<%= pkg.name %>.js',
        dest: 'build/<%= pkg.name %>.min.js'
      }
    },
    jsdoc: {
      dist: {
        src: ['<%= pkg.name %>.js' ],
        options: {
          destination: 'doc',
          template: "node_modules/grunt-jsdoc/node_modules/ink-docstrap/template",
          configure: "jsdoc.conf.json",
          readme: 'README.jsdoc.md'
        }
      }
    },
    requirejs: {
      compile: {
        options: {
          baseUrl: ".",
          mainConfigFile: "ffxiv_main.js",
          name: "bower_components/almond/almond",
          include: [ 'ffxiv_main' ],
          out: "ffxiv_optimized.js"
        }
      }
    }
  });

  // Load plugins
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-jsdoc');

  grunt.registerTask('default', ['requirejs', 'jsdoc']);
};
