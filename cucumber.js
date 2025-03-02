export default {
  default: {
    paths: ['tests/features/**/*.feature'],
    import: [
      'tests/step_definitions/**/*.ts',
      'tests/support/**/*.ts'
    ],
    format: ['progress-bar', 'html:cucumber-report.html'],
    requireModule: ['ts-node/register'],
    publishQuiet: true
  }
}; 