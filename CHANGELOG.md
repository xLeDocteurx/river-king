# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- First-run demo project seed: a « Demo » project with animated water, y-sort trees, a
  blocking boulder, and an interactable sign (#70).
- Release pipeline: GitHub Pages now deploys from the Actions workflow on `main` pushes and
  `v*` tags; a draft GitHub Release is created per tag (#73).
- Status bar shows the engine version (`River King Engine — vX.Y.Z`) from `package.json`
  (#74).
- Agent-driven release procedure through the `release` skill (#75).
