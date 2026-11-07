# Third-party license handling

Production builds emit `dist/THIRD_PARTY_NOTICES.txt`. Vite inventories bundled
dependencies; `tooling/third-party-licenses.ts` preserves their complete package-root
LICENSE, LICENCE, COPYING, and NOTICE files (including nested license directories).
Each JavaScript chunk links to `/THIRD_PARTY_NOTICES.txt`. Keep that file with the
deployment; no login is required to request this static asset.

The build fails if a bundled package has no license metadata or license text.
This is a completeness check, not an automated legal approval of new licenses.
Review license terms, additional vendored-code notices, and hosted-service terms
when updating dependencies. Build-only dependencies that contribute no modules to
the output are excluded.

## Reviewed upstream fallback files

These published packages declare MIT but omit their LICENSE files. The checked-in
copies preserve upstream text without edits. They are keyed to the exact installed
package versions; a new version without a license file fails the build until
reviewed. Builds do not fetch licenses over the network.

| Package version                 | Local file                              | Upstream license source                                                                                      |
| ------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@stylexjs/stylex@0.19.1`       | `stylex-0.19.1-LICENSE`                 | <https://github.com/facebook/stylex/blob/0fb4fef616c61bef0057381c7c4e1b52bf1fc512/LICENSE>                   |
| `react-remove-scroll-bar@2.3.8` | `react-remove-scroll-bar-2.3.8-LICENSE` | <https://github.com/theKashey/react-remove-scroll-bar/blob/7301c160fda44cb8cf2b9fdfde61efad35736196/LICENSE> |

The URLs pin the upstream commits that last changed each LICENSE when reviewed,
not the package release commits. The requested release tags were unavailable;
these sources match the MIT declaration in the installed package metadata.

## Package-specific notices

- `@openai/chatkit-react@1.6.1` and `@openai/chatkit@1.9.0` declare MIT in package
  metadata but ship Apache-2.0 LICENSE text. The notice records the discrepancy and
  preserves the distributed license text. It does not rewrite dependency metadata.
- `lucide-react@1.69.0` includes both the Lucide ISC notice and the MIT notice for
  Feather-derived icons. The whole LICENSE file is included, including Cole Bemis's
  copyright and the affected-icon list.
- The externally hosted ChatKit web component loaded by `src/services/chatkit.ts`
  is separate from the bundled React binding. This generated inventory does not
  establish rights to redistribute that CDN implementation or replace the terms
  of OpenAI, Vercel Analytics/Speed Insights, or Sentry's hosted services.
