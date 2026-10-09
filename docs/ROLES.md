# Roles and what each can do

Everyone is a **member** by default. An **admin** gives a person a different role on the **Admin** page
(**Make Usher / Pastor / Communications / Bishop / Admin**). The change applies the next time that person
opens the app.

| | Member | Usher | Pastor | Communications | Bishop | Admin |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Daily verse, reflections, prayer, own settings | yes | yes | yes | yes | yes | yes |
| **Team** page (their tools in one place) | | yes | yes | yes | (Bishop page) | (Bishop page) |
| Register a guest, record a return visit, send the welcome text | | yes | yes | yes | yes | yes |
| See the guest list | | yes | yes | yes | yes | yes |
| Change a guest's follow-up status and notes | | | yes | yes | yes | yes |
| See text message history | | | yes | yes | yes | yes |
| Send an announcement to a **congregation, a home circle or guests** | | | yes | yes | yes | yes |
| Send an announcement to **all members or all leaders** | | | | yes | yes | yes |
| Save and reuse announcements | | | yes | yes | yes | yes |
| **Edit the wording** of the thank-you, birthday and daily verse texts | | | | yes | yes | yes |
| Bishop dashboard, birthdays automation, push scheduling | | | | | yes | yes |
| Admin page: members, audit log, **assign roles** | | | | | | yes |

## How to use it

- **The welcome desk:** give ushers the **Usher** role. They open the app, tap **Team**, then **Register a guest**.
  They never see message history, other people's follow-up notes, or the Bishop dashboard.
- **Pastors** get everything an usher has, plus follow-up and texting their own congregation or circle. They cannot
  text the whole church; that is deliberate, to stop a mistake reaching everyone.
- **Communications** is for the person or team who looks after what the church says: wording, announcements to
  anyone, and guests.
- A person who is not signed in, or whose role is unknown, has no staff access at all.

## For developers

The table lives in one place, `packages/shared/src/roles.ts` (`ROLE_CAPABILITIES`), and is used by both sides:
the API enforces it with `guard('<capability>')` from `packages/api/src/middleware/capability.ts`, and the app uses
`can(role, '<capability>')` to decide what to show. To change who can do what, edit that table. Roles are stored in
the Postgres enum `user_role` (migration `0010_staff_roles.sql`).
