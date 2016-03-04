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
          { expand: true, src: [ 'web/*.{css,woff}' ], dest: 'build/', flatten: true },
        ]
      }
    },
    parsetimers: {
      dist: {
        files: [
          { src: [ 'build/lodestone-timers.json', 'web/timers.json' ], dest: 'build/timers.json' }
        ]
      }
    },
    scrapelodestone: {
      scrape: {
        dest: 'build/lodestone-timers.json'
      }
    },
    less: {
      dist: {
        options: {
          compress: true
        },
        files: {
          'build/ffxiv_timer.css': 'web/ffxiv_timer.less'
        }
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
    },
    connect: {
      test: {
        options: {
          keepalive: true
        }
      },
      dist: {
        options: {
          base: 'build',
          keepalive: true
        }
      }
    }
  });

  // Load plugins
  grunt.loadNpmTasks('grunt-bower-task');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-htmlmin');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadTasks('tasks');

  grunt.registerTask('default', ['bower', 'htmlmin', 'requirejs', 'less', 'copy', 'scrapelodestone', 'parsetimers', 'jsdoc']);
  // Create some aliases:
  grunt.registerTask('server', ['default', 'connect:dist']);
  grunt.registerTask('testserver', ['connect:test']);
};
