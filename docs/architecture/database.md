# Database

## Purpose

The application uses SQLite as the local persistent storage for V1.

SQLite stores user-owned application data:

- imported bookmark items
- item statuses
- tags
- item-to-tag relations
- generated summaries
- application settings
- sync run history

Chrome remains the source for bookmarks, while this database is the source for application-specific metadata.

## Principles

- The application does not write back to Chrome bookmarks in V1.
- User metadata must not be lost during repeated bookmark imports.
- Re-importing bookmarks should update existing items instead of creating duplicates.
- The frontend must not access SQLite directly.
- All database access goes through the local backend.

## Tables

### `items`

Stores normalized imported bookmarks.

Suggested columns:

- `id` - internal application identifier for the item.
- `source_type` - source connector that created the item, for example `chrome_bookmark`.
- `source_id` - original identifier from the source system if available. For Chrome bookmarks this can be derived from bookmark metadata or path.
- `title` - bookmark title imported from Chrome or later enriched by the application.
- `url` - original URL imported from Chrome.
- `normalized_url` - canonicalized URL used for deduplication and stable lookup.
- `domain` - hostname extracted from the URL, used for filtering and display.
- `status` - item lifecycle state in the application, initially `new`, `read`, or `archived`.
- `imported_at` - timestamp when the item was first added to the application database.
- `updated_at` - timestamp when the item row was last changed by the application.
- `last_seen_at` - timestamp when the same item was last found during bookmark import.
- `read_at` - timestamp when the user marked the item as read. Empty if never marked as read.
- `archived_at` - timestamp when the user archived the item. Empty if not archived.

Notes:

- `source_type` for V1 is expected to be `chrome_bookmark`.
- `normalized_url` should be used for deduplication.
- `status` should initially support `new`, `read`, and `archived`.

### `tags`

Stores user-defined tags.

Suggested columns:

- `id` - internal application identifier for the tag.
- `name` - user-facing tag name.
- `created_at` - timestamp when the tag was created.
- `updated_at` - timestamp when the tag was last renamed or otherwise changed.

Notes:

- Tag names should be unique after normalization.
- Tag rename should preserve item relations.

### `item_tags`

Stores many-to-many relations between items and tags.

Suggested columns:

- `item_id` - identifier of the item that receives the tag.
- `tag_id` - identifier of the assigned tag.
- `created_at` - timestamp when the tag was assigned to the item.

Notes:

- The pair `item_id`, `tag_id` should be unique.
- Deleting a tag should remove related rows from this table.

### `summaries`

Stores generated article summaries.

Suggested columns:

- `id` - internal application identifier for the summary.
- `item_id` - identifier of the item this summary belongs to.
- `summary_text` - generated summary text shown to the user. Stored as Markdown in a SQLite `TEXT` column.
- `model` - model identifier used to generate the summary.
- `provider` - AI provider used for generation, for example `openrouter`.
- `created_at` - timestamp when the summary was first generated.
- `updated_at` - timestamp when the summary was regenerated or edited.

Notes:

- V1 can keep only the latest summary per item.
- If later needed, this table can support summary history.

### `settings`

Stores application settings.

Suggested columns:

- `key` - setting name used by the application.
- `value` - serialized setting value.
- `updated_at` - timestamp when this setting was last changed.

Expected settings:

- `openrouter_api_key`
- `openrouter_model`
- `openrouter_summary_prompt`
- `openrouter_tags_prompt`
- `chrome_profile_path`

Notes:

- Sensitive values should be handled carefully.
- A later version may move secrets to OS-level secure storage.
- `chrome_profile_path` is the local Chrome user profile directory, not the Chrome executable path. On Windows it usually points to a folder like `C:\Users\<username>\AppData\Local\Google\Chrome\User Data\Default`, which contains the `Bookmarks` file.

### `sync_runs`

Stores bookmark import history.

Suggested columns:

- `id` - internal application identifier for the sync run.
- `source_type` - source connector used for the sync run, for example `chrome_bookmark`.
- `started_at` - timestamp when the sync run started.
- `finished_at` - timestamp when the sync run finished. Empty if the run is still active or crashed before completion.
- `status` - sync result status, for example `running`, `success`, or `failed`.
- `imported_count` - number of newly created items during this sync run.
- `updated_count` - number of existing items refreshed during this sync run.
- `error_message` - error details if the sync run failed.

Notes:

- Useful for debugging sync issues.
- Helps show the latest sync status in the UI.

## Deduplication Strategy

V1 should deduplicate imported bookmarks by `normalized_url`.

Initial normalization rules:

- trim whitespace
- lowercase protocol and host
- remove URL fragment
- remove common tracking parameters where safe
- normalize trailing slash consistently

Examples of tracking parameters:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`

## Future Extensions

Potential future tables:

- `article_contents` for cached extracted article text
- `ai_requests` for audit and cost tracking
- `reading_sessions` for reading analytics
- `sources` for multiple import providers
- `attachments` for saved article snapshots

These are intentionally excluded from the initial V1 schema unless implementation shows a clear need.
