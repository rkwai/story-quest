module.exports = {
  default: {
    paths: ['tests/features/**/*.feature'],
    require: ['tests/step_definitions/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: ['progress-bar', 'html:cucumber-report.html'],
    publishQuiet: true
  }
}; 