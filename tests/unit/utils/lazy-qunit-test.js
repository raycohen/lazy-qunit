import QUnit, { module, test } from 'qunit';

/*
  This apprach requires accessing Qunit.config.currentModule and Qunit.config.module

  Qunit.config.currentModule is used to determine the current module during the test
  gathering phase. This is the same way that `test` blocks know which module they
  belong to.

  `Qunit.config.module` is used during the test execution phase. By setting the very
  first `beforeEach` in the root module, we can do per-test setup that must happen
  for every test, including tests in nested modules. `Qunit.config.module` is the
  executing test's containing module. `parentModule` allows walking up the hierarchy
  so we can set up the lazy values needed by the current test from all of its containing
  modules. The lazy values from the parent must be setup first so that lazy values in
  nested modules override those in parent modules.
 */

function lazy(key, computeValueFunction) {
  // TODO: assert that setupLazy has been run on the top-level module
  const moduleConfig = QUnit.config.currentModule;

  // only to be referenced inside setupLazy
  moduleConfig.lazyComputations = moduleConfig.lazyComputations || [];
  moduleConfig.lazyComputations.push([key, computeValueFunction])
}

function setupLazy(hooks) {
  hooks.beforeEach(function(/* assert */) {
    // `config.current` is now the test config
    // `config.current.module` is the module
    let moduleConfig = QUnit.config.current.module;
    const moduleConfigsDeepestToRoot = [];
    while (moduleConfig) {
      moduleConfigsDeepestToRoot.push(moduleConfig);
      moduleConfig = moduleConfig.parentModule;
    }

    // Starting at the root, define lazys for each nested module.
    // Ordering matters so that nested lazy values can override those from parent modules.
    moduleConfigsDeepestToRoot.reverse().forEach((moduleConfig) => {
      defineLazyValues(this, moduleConfig);
    });
  });
}

function defineLazyValues(testEnvironment, moduleConfig) {
  const lazyComputations = moduleConfig.lazyComputations || [];
  lazyComputations.forEach(([key, computeValueFunctionOrValue]) => {
    let getter;
    if (typeof computeValueFunctionOrValue === 'function') {
      getter = computeValueFunctionOrValue;
    } else {
      getter = function () { return computeValueFunctionOrValue; };
    }
    Object.defineProperty(
      testEnvironment,
      key,
      {
        configurable: true,
        get: getter
      },
    );
  });
}

module('lazy', function(hooks) {
  setupLazy(hooks);

  lazy('firstName', function () { return 'Ray'; });
  lazy('lastName', function () { return 'Cohen'; });
  lazy('fullName', function() {
    return `${this.firstName} ${this.lastName}`;
  });

  test('top level module lazy values work', function(assert) {
    assert.equal(this.fullName, 'Ray Cohen');
  });

  module('nested module', function() {
    lazy('middleName', function () { return 'Hank'; });
    lazy('fullName', function () {
      return `${this.firstName} ${this.middleName} ${this.lastName}`;
    });

    test('lazy values work', function (assert) {
      assert.equal(this.fullName, 'Ray Hank Cohen');
    });

    module('a deeply nested module', function () {
      lazy('firstName', function () { return 'Victoria'; });
      lazy('middleName', 'Peggy');

      test('lazy values work', function (assert) {
        assert.equal(this.fullName, 'Victoria Peggy Cohen');
      });
    });

    module('another deeply nested module', function () {
      test('lazy values work', function (assert) {
        assert.equal(this.fullName, 'Ray Hank Cohen');
      });
    });
  });
});
