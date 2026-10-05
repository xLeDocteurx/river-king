import { version } from '../../../package.json';

/**
 * Application version, read from the `version` field of `package.json` at
 * build time. This is the single source of truth for the release version
 * (bumped manually in the release runbook, see `docs/release-process.md`).
 */
export const APP_VERSION = version;
