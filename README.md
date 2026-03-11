# Ross Video Search (Plugin)

WordPress plugin for **Meilisearch** full-page search and **AI Overview** (Gemini) on the search results page. Self-contained so you can transfer it between environments and version it with Git independently of the theme.

## Requirements

- PHP 7.4+
- WordPress 5.9+
- **Meilisearch** instance (e.g. search.rossvideo.app) and API key
- Optional: **Gemini API key** for AI Overview
- Optional: **Yuto** plugin if you use it to index content to Meilisearch

## Installation

1. Copy the `rossvideo-search` folder into `wp-content/plugins/`.
2. In **Plugins**, activate **Ross Video Search**.
3. Configure in `wp-config.php` (see below).

## Configuration (wp-config.php)

```php
// Meilisearch (required for search)
define('MEILI_HOST', 'https://search.rossvideo.app');
define('MEILI_API_KEY', 'your-meilisearch-api-key');

// AI Overview (optional)
define('GEMINI_API_KEY', 'your-gemini-api-key');
define('GEMINI_MODEL', 'gemini-2.0-flash'); // optional
define('AI_OVERVIEW_ENABLED', true);         // optional
```

Index names must match your Meilisearch server. Edit `includes/meilisearch/config.php` if your indexes differ (e.g. `rossvideo_get_meili_indexes()` and `rossvideo_get_meili_filter_options()`).

## Theme integration

The plugin enqueues its own scripts and styles. The theme only needs to:

1. **Open the full-page search** when the header search icon is clicked. Example (in theme JS):

   ```javascript
   if (window.RossVideoMeili && window.RossVideoMeili.FullPageSearch) {
     window.RossVideoMeili.FullPageSearch.open();
   }
   ```

2. **Output the AI Overview block on the search results page** by calling the action in `search.php`:

   ```php
   <?php do_action('rossvideo_search_ai_overview'); ?>
   ```

If your theme already does this (e.g. rossvideo theme), no change is needed beyond activating the plugin and removing any theme-based Meilisearch/AI Overview includes.

## “Hidden from Search” tag

The plugin respects the tag slug **hidden-from-search** (constant `ROSSVIDEO_HIDDEN_FROM_SEARCH_TAG_SLUG`): it will not index those posts to Meilisearch and will remove them from the index when the tag is applied. The theme can still use the same slug for WordPress native search (e.g. via `exclude_tag_from_search.php`) and hide the tag from display.

## Git and deployment

- Use this plugin folder as its own Git repo, or include it in your site repo.
- To deploy: copy the plugin to `wp-content/plugins/rossvideo-search/` on the target site and activate.
- Set `MEILI_HOST`, `MEILI_API_KEY`, and optionally `GEMINI_API_KEY` in the target environment (wp-config or env vars).

## File layout

```
rossvideo-search/
├── rossvideo-search.php       # Bootstrap, constants, requires
├── includes/
│   ├── meilisearch/           # Config, client, AJAX, init, hidden-from-search
│   ├── ai-overview/           # Config, Gemini client, AJAX, init
│   └── yuto-customizations.php
├── assets/
│   ├── js/                    # meilisearch-*.js, ai-overview.js, yuto-custom-fields.js
│   ├── css/                   # meilisearch.css, meilisearch-fullpage.css, ai-overview.css
│   └── img/                   # ross-video-logo.svg (fallback logo)
├── README.md
└── .gitignore
```

## Admin

- **Settings → Meilisearch**: connection status, indexes, test search.
- **Settings → AI Overview**: config status, test AI overview.

## Filters

- `rossvideo_meili_theme_url` – base URL for theme (e.g. for logo).
- `rossvideo_meili_logo_url` – full URL for the logo image in the fullpage modal.
- `rossvideo_use_meilisearch` – enable/disable Meilisearch (default `true`).
- `rossvideo_meili_indexes` – list of index UIDs.
- `rossvideo_meili_filter_options` – filter buttons (key + label).
