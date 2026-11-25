const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const artifactDir =
  "C:\\Users\\SHRIRAM\\.gemini\\antigravity\\brain\\8822075f-d15f-4b2b-a76d-782c72eff912\\screenshots";
const localDir = path.join(__dirname, "..", "screenshots");

if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

const tempUserData = "C:\\Users\\SHRIRAM\\AppData\\Local\\Temp\\chrome-shots";

const views = [
  { name: "login", url: "http://localhost:8080/" },
  { name: "unauthorized", url: "http://localhost:8080/" },
  { name: "home", url: "http://localhost:8080/?tab=home" },
  { name: "loads", url: "http://localhost:8080/?tab=loads" },
  { name: "parties", url: "http://localhost:8080/?tab=parties" },
  { name: "reports", url: "http://localhost:8080/?tab=reports" },
  { name: "settings", url: "http://localhost:8080/?tab=settings" },
  { name: "newload_step1", url: "http://localhost:8080/?newLoad=true&step=1" },
  { name: "newload_step2", url: "http://localhost:8080/?newLoad=true&step=2" },
  { name: "newload_step3", url: "http://localhost:8080/?newLoad=true&step=3" },
];

const viewports = [
  { label: "375x812", width: 375, height: 812 },
  { label: "360x640", width: 360, height: 640 },
];

for (const vp of viewports) {
  for (const view of views) {
    const filename = `${view.name}_${vp.label}.png`;
    const localFile = path.join(localDir, filename);
    const artifactFile = path.join(artifactDir, filename);

    console.log(`Capturing ${filename} (${vp.width}x${vp.height}) from ${view.url}...`);
    try {
      const cmd = `"${chromePath}" --headless=new --disable-gpu --user-data-dir="${tempUserData}" --window-size=${vp.width},${vp.height} --screenshot="${localFile}" "${view.url}"`;
      execSync(cmd, { stdio: "pipe" });

      // Copy to artifact directory
      if (fs.existsSync(localFile)) {
        fs.copyFileSync(localFile, artifactFile);
        const stats = fs.statSync(localFile);
        console.log(`✓ Saved ${filename} (${stats.size} bytes)`);
      } else {
        console.warn(`! Output file not found for ${filename}`);
      }
    } catch (err) {
      console.error(`Error capturing ${filename}:`, err.message);
    }
  }
}
console.log("All screenshots completed.");
