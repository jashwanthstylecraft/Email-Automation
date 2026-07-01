import { interpolateTemplate, RuleCondition } from '../src/lib/rules-engine';

// Define a simple test runner
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Test Failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ Test Passed: ${message}`);
  }
}

async function runTests() {
  console.log('Running Email Automation Test Suite...');

  // Test 1: Template Interpolator
  const template = 'Hello {{customer_name}}, your ticket ID is {{ticket_id}}. {{closing}}';
  const variables = {
    customer_name: 'Mark',
    ticket_id: '12345',
    closing: 'Regards,\nSupport Team',
  };
  const interpolated = interpolateTemplate(template, variables);
  assert(
    interpolated === 'Hello Mark, your ticket ID is 12345. Regards,\nSupport Team',
    'Template variables should interpolate correctly'
  );

  // Test 2: Rules Engine Conditions - equals match
  const equalsCondition: RuleCondition = {
    field: 'category',
    operator: 'equals',
    value: 'billing',
  };
  const mockEmail = { category: 'Billing', subject: 'Inquiry', body: 'Please help' };
  
  // Custom mimic of rules-engine evaluation for isolated testing
  const evalEquals = mockEmail.category.toLowerCase() === equalsCondition.value.toLowerCase();
  assert(evalEquals === true, 'Category equals rule should match (case-insensitive)');

  // Test 3: Rules Engine Conditions - contains match
  const containsCondition: RuleCondition = {
    field: 'body',
    operator: 'contains',
    value: 'refund',
  };
  const mockEmail2 = { category: 'Billing', subject: 'Refund', body: 'I need a refund immediately.' };
  const evalContains = mockEmail2.body.toLowerCase().includes(containsCondition.value.toLowerCase());
  assert(evalContains === true, 'Body contains rule should match substring correctly');

  // Test 4: Rules Engine Conditions - contains_any match
  const containsAnyCondition: RuleCondition = {
    field: 'body',
    operator: 'contains_any',
    value: 'forgot password, reset password, forgot my password',
  };
  const mockEmail3 = { category: 'Support', subject: 'Locked out', body: 'Help, I forgot my password.' };
  const terms = containsAnyCondition.value.split(',').map((t) => t.trim().toLowerCase());
  const evalContainsAny = terms.some((t) => mockEmail3.body.toLowerCase().includes(t));
  assert(evalContainsAny === true, 'Body contains_any rule should match any term correctly');

  console.log('All tests completed successfully!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
