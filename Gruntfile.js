module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
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
    bower: {
      install: {
        options: {
          targetDir: 'web/lib'
        }
      }
    },
    htmlmin: {
      dist: {
        options: {
          removeComments: true,
          collapseWhitespace: true
        },
        files: {
          'build/ffxiv_timer.html': 'web/ffxiv_timer.html'
        }
      },
    },
    copy: {
      main: {
        files: [
          { expand: true, src: [ 'web/*.{css,woff,json}' ],  dest: 'build/', flatten: true },
        ]
      }
    },
    requirejs: {
      compile: {
        options: {
          baseUrl: "web",
          mainConfigFile: "web/ffxiv_main.js",
          name: "lib/almond/almond",
          include: [ 'ffxiv_main' ],
          out: "build/ffxiv_optimized.js"
        }
      }
    }
  });

  // Load plugins
  grunt.loadNpmTasks('grunt-bower-task');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-htmlmin');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-jsdoc');

  grunt.registerTask('default', ['bower', 'htmlmin', 'requirejs', 'copy', 'jsdoc']);
};
