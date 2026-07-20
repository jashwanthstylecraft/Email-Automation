async function main() {
  try {
    console.log('Fetching /api/logs...');
    const res = await fetch('http://localhost:3000/api/logs');
    console.log('Logs status:', res.status);
    const body = await res.json();
    console.log('Logs body:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Error fetching logs:', err);
  }

  try {
    console.log('Fetching /api/dashboard...');
    const res = await fetch('http://localhost:3000/api/dashboard?orgId=26a62d23-7e2f-4313-888e-5caeca075332');
    console.log('Dashboard status:', res.status);
    const body = await res.json();
    console.log('Dashboard body:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Error fetching dashboard:', err);
  }
}

main();
