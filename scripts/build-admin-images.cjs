const fs = require('node:fs');
const path = require('node:path');

const IMAGE_RE = /\.(png|jpe?g|webp|gif|svg)$/i;

function walkImages(root, relative) {
  const result = [];
  const full = path.join(root, relative);

  if (!fs.existsSync(full)) return result;

  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const name = relative + '/' + entry.name;

    if (entry.isDirectory()) {
      result.push(...walkImages(root, name));
    } else if (entry.isFile() && IMAGE_RE.test(entry.name)) {
      result.push(name.replaceAll('\\', '/'));
    }
  }

  return result;
}

function imagePaths(root) {
  return [
    ...walkImages(root, 'evidence-inbox'),
    ...walkImages(root, 'images')
  ].sort();
}

function uniqueSorted(paths) {
  return [...new Set(paths)].sort((a, b) => a.localeCompare(b));
}

function siteImageInventory(root) {
  const all = imagePaths(root);

  const definitions = {
    ammo: {
      label: 'Ammo',
      prefixes: ['images/ammo/', 'evidence-inbox/ammo/']
    },
    armour: {
      label: 'Armour',
      prefixes: ['images/armour/', 'evidence-inbox/armour/']
    },
    attachments: {
      label: 'Attachments',
      prefixes: ['evidence-inbox/attachments/']
    },
    blueprints: {
      label: 'Blueprints',
      prefixes: ['evidence-inbox/blueprints/']
    },
    site: {
      label: 'Site',
      prefixes: [
        'images/backgrounds/',
        'images/branding/',
        'images/scavland-banner'
      ]
    },
    crafting: {
      label: 'Crafting',
      prefixes: ['images/crafting/', 'evidence-inbox/crafting/']
    },
    factions: {
      label: 'Factions',
      prefixes: ['images/factions/', 'evidence-inbox/factions/']
    },
    items: {
      label: 'Items',
      prefixes: ['images/items/', 'evidence-inbox/items/']
    },
    map: {
  label: 'Map',
  prefixes: [
    'images/scavlandmap',
    'evidence-inbox/map/'
  ]
},
    vendors: {
      label: 'Vendors',
      prefixes: ['images/vendors/', 'evidence-inbox/vendors/']
    },
    weapons: {
      label: 'Weapons',
      prefixes: ['images/weapons/', 'evidence-inbox/weapons/']
    }
  };

  const categories = {};

  for (const [key, definition] of Object.entries(definitions)) {
    categories[key] = {
      label: definition.label,
      images: uniqueSorted(
        all.filter(image =>
          definition.prefixes.some(prefix => image.startsWith(prefix))
        )
      )
    };
  }

  /*
   * Intentionally excluded from the normal site/Admin picker:
   *   evidence-inbox/admin/
   *   evidence-inbox/context/
   *   evidence-inbox/unresolved/
   *   images/screenshots/
   *
   * They remain available in admin-images.json as evidence,
   * but are not normal selectable site artwork.
   */

  const flat = uniqueSorted(
    Object.values(categories).flatMap(category => category.images)
  );

  return {
    schemaVersion: 2,
    description:
      'Site image inventory. The flat images list remains for backwards compatibility; categories power the visual image picker.',
    categories,
    images: flat
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');

  const allImages = imagePaths(root);
  const siteImages = siteImageInventory(root);

  writeJson(
    path.join(root, 'data/admin-images.json'),
    allImages
  );

  writeJson(
    path.join(root, 'data/site-images.json'),
    siteImages
  );

  console.log(
    `Indexed ${allImages.length} pictures from all image and evidence subfolders.`
  );

  console.log(
    `Indexed ${siteImages.images.length} selectable site pictures across ` +
    `${Object.keys(siteImages.categories).length} categories.`
  );
}

module.exports = {
  imagePaths,
  siteImageInventory
};