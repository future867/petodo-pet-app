# Petodo frontend assets

This folder keeps runtime assets for the Electron frontend.

## Structure

```text
assets/
├── pet/
│   └── luoxiaohei/
│       ├── theme.json
│       ├── gif/
│       ├── img/
│       ├── icons/
│       └── sounds/
├── ui/
│   ├── icons/
│   ├── bubbles/
│   ├── backgrounds/
│   └── rewards/
├── _review-unused/
└── _duplicates/
```

Runtime pet assets stay in `pet/luoxiaohei/`. Files that are not loaded by the app are kept in `_review-unused/` so they can be checked and deleted manually later.

Do not delete uncertain or duplicate-looking assets. Move unused review files to `_review-unused/` and duplicate candidates to `_duplicates/`.
