module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    ts: {
      options: {
        module: 'umd'
      },
      default: {
        src: [ 'clock.ts' ]
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: '<%= pkg.main %>',
        dest: 'build/<%= pkg.name %>.min.js'
      }
    },
    jsdoc: {
      dist: {
        src: [ '<%= pkg.main %>', 'clock-debug.js' ],
        options: {
          destination: 'doc',
          template: "node_modules/ink-docstrap/template",
          configure: "jsdoc.conf.json",
          readme: 'README.jsdoc.md'
        }
      }
    }
  });

  // Load plugins
  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-jsdoc');

  grunt.registerTask('default', ['ts', 'uglify', 'jsdoc']);
};
