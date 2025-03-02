module.exports = {
  default: {
    paths: ['tests/features/**/*.feature'],
    require: ['tests/step_definitions/**/*.js', 'tests/support/**/*.js'],
    format: ['progress-bar', 'html:cucumber-report.html']
  }
}; 