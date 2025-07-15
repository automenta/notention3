import './src/index.css';
import './src/web-components/NotentionApp.ts'; // Import the main app component

document.addEventListener('DOMContentLoaded', () => {
  document.body.innerHTML = '<notention-app></notention-app>';
});
