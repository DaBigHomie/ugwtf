# UGWTF Project Configurations

Per-project configuration overrides, chain configs, and audit results.

## Structure

```
projects/
├── o43/              # ONE4THREE (one4three-co-next-app)
├── damieus/          # Damieus.com (damieus-com-migration)
├── ffs/              # Flipflops Sundays (flipflops-sundays-reboot)
├── maximus/          # MAXIMUS AI (maximus-ai)
└── cae/              # CAE Luxury Hair (cae-luxury-hair)
```

Each project folder can contain:
- `prompt-chain.json` — Prompt execution chain config
- `audit-results/` — Historical audit JSON snapshots
- `overrides.json` — Project-specific config overrides
