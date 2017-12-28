module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jsdoc: {
      dist: {
        src: [ 'clock.js', 'clock-debug.js', 'web/ffxiv_countdown.js', 'web/ffxiv_builtins.js' ],
        options: {
          destination: 'doc',
          template: "node_modules/ink-docstrap/template",
          configure: "jsdoc.conf.json",
          readme: 'README.jsdoc.md'
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
    parsetimers: {
      dist: {
        files: [
          { src: [ 'build/lodestone-timers.json', 'web/timers.json' ], dest: 'build/timers.json' }
        ]
      }
    },
    scrapelodestone: {
      scrape: {
        dest: 'build/lodestone-timers.json',
        options: {
          ignore: 'web/timers.json'
        }
      }
    },
    less: {
      dist: {
        options: {
          compress: true
        },
        files: {
          'build/ffxiv-timer.css': 'web/ffxiv_timer.less'
        }
      }
    },
    requirejs: {
      compile: {
        options: {
          baseUrl: "web",
          mainConfigFile: "web/ffxiv_main.js",
          name: "../node_modules/almond/almond",
          include: [ 'ffxiv_main' ],
          out: "build/ffxiv.js"
        }
      }
    },
    cacheBust: {
      dist: {
        options: {
          baseDir: './build',
          assets: [ 'ffxiv.js', 'ffxiv-timer.css' ]
        },
        src: ['./build/ffxiv_timer.html']
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
    },
    clean: {
      build: [ 'build' ],
      lodestone: [ 'build/lodestone-timers.json' ]
    }
  });

  // Load plugins
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-htmlmin');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks('grunt-cache-bust');
  grunt.loadTasks('tasks');

  grunt.registerTask('default', ['htmlmin', 'requirejs', 'less', 'scrapelodestone', 'parsetimers', 'jsdoc', 'cacheBust']);
  // Create some aliases:
  grunt.registerTask('server', ['default', 'connect:dist']);
  grunt.registerTask('testserver', ['connect:test']);
};
