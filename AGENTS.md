# Public notice policy

# Required public compatibility notice

- Always include the canonical notice at the end of the full store description for both iOS and Android, and in the website compatibility footer. It is not just release-note text.
- Keep normal operation, future hardware/firmware/protocol/OS changes, and continued updates/support as separate statements. Do not narrow the normal-operation disclaimer to future changes only.
- The last sentence must remain: "Continued updates and support for StajPilot are not guaranteed."
- Preserve the wording unless the user explicitly approves a change. Verify the actual saved store fields and published pages before marking the task complete.

- Canonical wording: `compatibility-notice.txt`.
- Keep the Home, iOS, Android, and Support footers consistent. Run `node --test notice.test.cjs` before publishing.
- Do not change app behavior, pricing, release tracks, or store submission status as part of a wording-only update.
