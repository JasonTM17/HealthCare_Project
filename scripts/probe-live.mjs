async function probe() {
  const urls = [
    'https://www.healthcare.id.vn',
    'https://www.healthcare.id.vn/doctors',
    'https://www.healthcare.id.vn/articles',
    'https://www.healthcare.id.vn/articles/phong-ngua-dot-quy-o-nguoi-tre-va-trung-nien',
    'https://www.healthcare.id.vn/articles/dot-quy-nhan-biet-gio-vang'
  ];

  for (const url of urls) {
    try {
      const start = Date.now();
      const res = await fetch(url, { redirect: 'manual' });
      const elapsed = Date.now() - start;
      console.log('[PROBE] ' + url + ' -> Status: ' + res.status + ' (' + elapsed + 'ms)');
      if (res.status === 307 || res.status === 308 || res.status === 301 || res.status === 302) {
        const location = res.headers.get('location');
        console.log('       Redirect to: ' + location);
        const followRes = await fetch(new URL(location, url).href);
        console.log('       Followed redirect -> Status: ' + followRes.status);
      }
    } catch (e) {
      console.error('[ERROR] ' + url + ' failed: ' + e.message);
    }
  }
}
probe();
