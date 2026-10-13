const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'reports/capture-manifest.json'), 'utf8'));
for (const tour of manifest.tours) {
  if (process.env.REPO_TOUR_NAMES && !process.env.REPO_TOUR_NAMES.split(',').includes(tour.name)) continue;
  if ((tour.status && tour.status !== 'PASS') || tour.routes.length !== (tour.expectedRoutes || 5) || !tour.video) throw new Error('Incomplete tour: ' + tour.name);
  const target = path.join(root, 'docs/assets/repo-tours', tour.name + '-tour.gif');
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '1.5', '-i', path.join(root, tour.video), '-filter_complex', '[0:v]fps=5,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', target];
  const result = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('GIF conversion failed for ' + tour.name + ': ' + result.stderr);
  console.log(tour.name + ': ' + (fs.statSync(target).size / 1024 / 1024).toFixed(2) + ' MiB');
}
