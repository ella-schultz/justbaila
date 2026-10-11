# Mission Desk Architecture

## Information architecture

Mission Desk uses permanent HTML workspaces. Every major control lives in its visible operational area before JavaScript runs:

- **Overview** — actionable operating picture and shortcuts.
- **Members** — directory, selected-member context, physical cards, membership nominations/invitations, and instructor permissions.
- **Missions & Assignments** — mission creation, private/global assignment configuration, verification methods, and the mission library.
- **Progression** — level reference, milestones, rewards, and redemption fulfillment.
- **Community** — Door Mode, social visibility, events/attendance, Signals, and Classifieds moderation.
- **Workshop** — Workshop challenge creation and management.
- **Technique Lab** — availability, feedback requests, evaluations, member status, and links to instructor permissions.
- **Unlocks & Hidden Systems** — Archive content and a reference map for code-managed discovery systems.
- **Content & Configuration** — the public class schedule and featured invitation.
- **Activity & History** — meaningful audit activity and append-only corrections.

Navigation is intentionally shallow: workspace, then an optional in-page section link. JavaScript changes visibility and focus; it does not reparent panels or construct the information architecture.

## Quick Find

The sidebar Quick Find searches a static registry of authoritative Mission Desk tools and aliases. Selecting a result activates the owning workspace, updates the URL fragment, scrolls to the permanent station, and focuses its first control. Add new tools to `deskTools` in `admin-local/admin.js`; do not clone the control.

## Actionable badges

Badges indicate work requiring attention, not record totals:

- Members: PIN reset requests plus open membership nominations/invitations.
- Progression: pending reward redemptions.
- Community: unresolved Classifieds reports.
- Technique Lab: waiting feedback requests.

## Member context

The directory opens one selected-member context panel. It summarizes identity, account state, level, Keys, missions, assignments, milestones, attendance, Workshop, Technique, Signals, and rewards from the existing admin passport response. Context buttons jump to the authoritative editor or open the existing member preview. Editors are not duplicated inside the context panel.

## Permissions and ownership

Moving a panel does not change authorization. The Worker remains the authority for admin authentication, instructor authorization, and mutation permissions. Frontend visibility is navigation only and must never be treated as access control.

Each operation has one authoritative control. Contextual access may navigate to it, but new features should not introduce a second mutation implementation.

## Retired scaffolding

Wave 2 retired `organizeControlCenter()`, `makeStation()`, donor workspaces for JustBaila/After Dark/Signals/Technique, and runtime panel moves. New systems must be placed directly in the correct workspace markup.

## Adding a feature

1. Choose the operational owner above.
2. Add permanent semantic markup to that workspace.
3. Add a shallow section link when useful.
4. Add one Quick Find registry entry and aliases.
5. Add a badge only for a genuine action queue.
6. Keep authorization enforced in the Worker.
7. Extend structural tests to prove the control remains unique and reachable.
