# ACP-420 study notes

Compiled October 2026 from: the official V2 exam topics PDF (April 2025), Atlassian Community threads from people who passed, Hean Tech's ACP-420 study sessions (the YouTube playlist), and the Atlassian docs linked in the `URLs` file.

> **Note on terms:** Jira Cloud now says **space** instead of project and **work item** instead of issue. Automation "rules" are now "flows", and the "virtual agent" is the "virtual service agent". Exam questions may use either the old or the new terms.

## About the exam

| Item | What we know | How sure |
|---|---|---|
| Version | V2, released 15 April 2025 | High (Atlassian staff) |
| Format | Up to 75 questions in 180 minutes; single-answer and multiple-answer scenario questions | Medium (third-party sources) |
| Pass mark | 66% is most often quoted; one 2024 post says 60% | Low. Check your registration page |
| Delivery | Proctored online or at a test centre | High |
| Price and retakes | US $249 per attempt; each retake needs a new voucher | Medium |
| Validity | 24 months; you have 90 days after purchase to sit the exam | High |
| Difficulty | Similar to ACP-120. Data Center admins say the Cloud-only features are the hard part | Community posts |

### Domain weights (V2)

- Customer-facing features: 21%
- Agent-facing features: 19%
- Users, roles and permissions: 16%
- Portal and notifications: 12%
- Automation: 11%
- Assets, Services and Entitlements: 9%
- Reporting: 7%
- Knowledge base: 5%

## Tips from people who passed

1. **Build a free JSM Cloud trial site** and set up every bullet in the topics PDF yourself. Every source gives this tip.
2. **Use Cloud experience, not Data Center.** Watch out for Cloud-only features such as forms, the virtual agent, on-call, Atlassian Intelligence, entitlements and services.
3. **Study weighted by %.** Customer-facing plus agent-facing features make up about 40% of the exam.
4. **Do the official sample questions last.** They match the style of the real exam.
5. **Read wording carefully.** Look for "NOT", "best" and "minimum". Use elimination, and flag questions to come back to.
6. **Write a 2–3 page permissions brain dump.** People say permissions are the most confusing area.
7. **Avoid braindump sites.** They break the certification agreement and are often wrong.

## Key facts by domain

### 1. Users, roles and permissions

- **Agent** = JSM agent product access (a licence) plus the **Service Desk Team** role. Customers are free and portal-only.
- **Collaborator** = a licensed Jira user without JSM access. They can view work items, add internal comments, attach files, watch and vote. They can't reply to customers, be assigned, or transition work items.
- Removing someone from the Service Desk Team role does **not** free their licence. Licences come from product access, so remove the group or product access in Atlassian Administration.
- **Permission layers:**
  - Product access
  - Global permissions
  - Permission scheme (project roles)
  - Customer permissions
  - KB permissions
  - Work item security
- **Customer permissions** (Space settings > Access / Customer permissions):
  - Restricted: only invited customers can raise requests. Open: anyone with an account can.
  - Sharing has three levels: organisation only, organisation plus typed email, or anyone in the project.
  - The project's restriction wins over the site-level setting "customers can create accounts".
- **Organisations** are site-wide.
  - Removing one from a project keeps it on the site. Deleting it from the site removes it everywhere.
  - Deleting an organisation never deletes the customers in it.
- **Work item security:** if a customer can't see their own secured request, add **Reporter** to the security level.
- **Request type restrictions** control who can *raise* a request type. **Security levels** control who can *view* existing work items.
- **Default assignee error** on the portal means the assignee lacks the Assignable User permission or a licence, or "Allow unassigned" is off.
- **Assignee sources:** manual, project default, component lead, a hidden preset value on the request form, or automation.
- **Portal-only customers** are managed only by organisation admins, and they log in through the help centre.

### 2. Agent-facing features

- **SLA structure** = conditions (Start / Pause / Stop) + goals (JQL + target + calendar).
  - Goals are matched **first match, top-down**. The last row, "All remaining", defaults to "No target".
  - **Pause** = waiting for the customer. **Stop** ends the cycle.
  - Editing an SLA recalculates only running cycles. Completed cycles need a manual recalculation.
  - A calendar sets the time zone, working hours (several slots per day) and holidays. Without a calendar the SLA counts 24/7.
- **SLA JQL:**
  - `breached()`: last cycle
  - `everBreached()`: any cycle
  - `completed()`, `running()`, `paused()`: none of these return cycles that haven't started
  - `withinCalendarHours()`: based on the calendar, not the conditions
  - `elapsed("1h")`, `remaining("2h")`: work with `< <= > >=`
- **Queues:**
  - Limit of 50 per work category.
  - Groups are **Starred** (per agent), **Team priority** (admin, everyone sees it) and **Other** (collapsed, counts don't auto-refresh).
  - Avoid "all issues" queues with no date limit, text-search queues and one queue per person.
- **Features page:**
  - Service requests, incidents, problems, changes, post-incident reviews (PIRs)
  - Board, calendar
  - Services, Products and entitlements
  - **Feature lab** for testing new features
- **ITSM:**
  - Problems handle the root cause of recurring incidents. A known error is a problem with a root cause and a workaround.
  - Change types: Standard (pre-approved), Normal (CAB), Emergency.
  - PIRs document what happened and the follow-up actions.
- **On-call:**
  - Rotations are daily, weekly or custom.
  - **Overlapping rotations add up**: everyone in them is on call.
  - **Override**: someone else covers a time slot. "Take on-call" is the quick override for yourself.
  - **Forwarding rule**: one user's notifications go to another user.
- **Escalations:**
  - Each rule runs after a delay if the alert is "not acknowledged" or "not closed". Acknowledging stops the "not acked" rules.
  - Repeats are allowed up to 20 times.
- **Routing rules:** evaluated top-down, and the first match wins. Each team gets a default escalation policy.
- **Alerts:**
  - Priority runs from P1 (highest) to P5. The default is **P3**.
  - **Alert policies** change the alert before it's created.
  - **Notification policies** delay, suppress, auto-restart or auto-close notifications.
  - Alert priorities map to Jira priorities.
- **Chat:** Slack and Teams incident channels. Responders, status and stakeholders can be updated from chat.

### 3. Assets, Services and Entitlements

- **Assets terms:**
  - Schema: a container of object types
  - Object type: a group of objects with the same attributes
  - Object: one asset
  - Attribute: a field on an object
  - Reference: an attribute that links to another object (inbound or outbound)
- You need to *use* schemas, not design them.
- **Assets objects field:**
  - **Filter scope (AQL)** can't use placeholders.
  - **Filter work scope (AQL)** can, for example `Owner = ${reporter}`.
  - Limit of 200 objects.
  - Adding the field to a request type gives customers the view-only Assets role.
- **Services:**
  - Turn them on in Features. They're site-wide and sync to a read-only "Services" schema in Assets.
  - Each service has a type, a tier (1 is most critical, 4 is lowest), owners, change approvers, responders, stakeholders and relationships (depends on / used by).
  - Services are linked through the **Affected services** field. Tiers can be used in automation conditions and alerts.
- **Products and entitlements:**
  - Turn them on in Features.
  - Add entitlements to customers or organisations, then add the Entitlement field to request types. Make it **required** so only entitled customers can raise requests.
  - Detail JQL (`customerDetail`, `organizationDetail`, `entitlementDetail`, `entitlementProduct`) supports **IN / NOT IN only**.

### 4. Customer-facing features

- **Request types and work types:** one request type maps to exactly one work type, and one work type can back many request types.
- A request type with **no portal group** is hidden from the portal, but email and agents can still use it.
- **Request form:**
  - Each field gets its own customer-facing name and help text.
  - "Use preset value and hide from portal": a hidden required field needs a valid preset, or the portal shows an error.
  - Required in the **field configuration** means required everywhere. Required in the **request type** means required on the portal only.
- **Statuses:** customer-facing status names are set per request type. Two statuses with the same customer name don't trigger a "status changed" notification.
- **Agent view vs customer view:** agents see the screen scheme; customers see the request form.
- **Forms:**
  - Layout options: tables, bullet lists, quotes and columns.
  - **Sections with conditional logic.**
  - Linked Jira fields. If the same field is hidden with a preset, **the preset wins**.
  - Translations and shareable links.
  - Can be attached to request types, added by agents, or attached/copied by automation.
- **Form settings:**
  - *Keep this form open for edits*: customers can edit and resubmit.
  - *Lock once submitted*: only admins can reopen.
  - *Save a PDF on each resubmit.*
  - *Show as recommended*: appears at the top when agents add a form.
- **Email:**
  - Each email address uses one request type.
  - Only Summary, Description and Attachment may be required. Hide any other required field with a preset.
  - **Allowlist** = only these senders. **Blocklist** = ignore these senders.
  - Turning email off also stops customer replies from becoming comments.
- **Approvals:**
  - Add an approval to a status, using a user or group picker (Approvers).
  - Field on the form = customers choose the approvers. Hidden preset = a fixed list of approvers.
  - Approvers don't need a licence.
  - The Decline transition must set a Resolution, or the request stays unresolved.
- **Portal transitions:** you can show a workflow transition, such as Cancel, on the portal.

### 5. Portal and notifications

- **Announcements:**
  - Portal announcements can be posted by project admins, and they can let agents post them too.
  - The help centre has its own announcement.
  - The Jira banner doesn't show on the portal.
- Portal groups, external help links and the website widget.
- **Language:**
  - The customer's profile language comes first, then the browser language, then the default.
  - You can translate request types, fields, groups, announcements, notifications and email templates.
- **Virtual agent:**
  - Set a default request type for escalations.
  - **Intents** have a name, description and training phrases, plus a flow.
  - **Standard flows:** Greet, Escalate, Resolve, Match intent, Auto-close.
  - **AI answers** come from the linked knowledge base.
  - The Send web request step can call outside systems.
  - Review past conversations to improve it.
- **Customer notifications:**
  - Events: request created, public comment added/edited, customer-visible status changed, resolved/reopened, participant added, organisation added, approval required.
  - Internal comments never notify customers.
  - An agent who is the reporter or a participant gets customer notifications, not internal ones.
  - The email log lists failed notifications.
- **Canned responses:** shared responses are created by admins, and personal ones are visible only to their owner.

### 6. Knowledge base

- Link Confluence spaces in Space settings > Knowledge base. You can also set who can view (all customers, anyone, or licensed users only) and who can edit.
- Agents can create articles without a Confluence licence if the linked space's permissions allow it.
- **Anonymous viewing** needs Confluence public access at both site and space level.
- **Article suggestions** can be set per request type and limited to certain labels.

### 7. Reporting

- **Approval JQL:**
  - `approval = approved()`, `pending()`
  - `myPending()`: only pending approvals
  - `myApproval()`: includes completed approvals
  - `approver()`, `pendingBy()`
- Saved filters are private until you share them.
- Atlassian Intelligence can write JQL from plain language.
- **Custom reports** are built from **series** (created, resolved, SLA met or breached, CSAT and so on), each with JQL.
- Dashboards can use JSM gadgets.
- **CSAT** (company-managed):
  - Sent when the Resolution is set and the "Request resolved" notification is on.
  - Goes to the reporter only.
  - The work item must have a request type.

### 8. Automation

- **JSM triggers:** SLA threshold breached, Approval required, Approval completed, Assets object created/updated/deleted, alert triggers. "Forms submitted" also exists in all of Jira; if you select several forms, all of them must be submitted.
- **Conditions:** Affected services (tier, name), Forms attached, Assets AQL.
- **Actions:**
  - Create incident, Edit request type (must use the same work type), Add service project customer
  - Approve or decline (no smart values)
  - Create work item with request type
  - Lookup / create / edit objects (`{{lookupObjects}}`)
  - Attach / copy forms
  - Send customised email
- **Actor vs owner:**
  - The **actor** performs the actions. The default is "Automation for Jira".
  - The **owner** gets error emails, so transfer ownership when people leave.
- **Scope:** single-project rules can be managed by project admins. Multi-project and global rules need a Jira admin.
- **Troubleshooting:**
  - The audit log is kept for 90 days. Use the **Log action** to print smart values.
  - Check the Atlassian status page when many rules fail at once.
  - **Performance insights** show execution count, duration, and whether a rule was throttled or looping.
- **Limits:** 65 components per rule, 10 for loop detection.
- Smart values: `.format("dd.MM.yyyy")`, `.join(", ")`, list properties.
- Labels help organise rules. Disabling a rule keeps its settings. Atlassian Intelligence can draft rules.

## Sources

- Official topics PDF (V2, April 2025): https://assets.ctfassets.net/xkfunaz6zr9g/4hdJr7OSlHjFPefoR6LWvz/fc2dfb84f7e68bbc4f1648ad440a64a6/acp-420-managing-service-projects-for-cloud.pdf
- My experience passing ACP-420: https://community.atlassian.com/forums/Training-Certification/My-Experience-Passing-the-Atlassian-ACP-420-Managing-Jira/td-p/3124043
- How hard is ACP-420?: https://community.atlassian.com/forums/JSM-News-Discussions-discussions/How-hard-is-ACP-420/td-p/2603658
- Any tips for ACP-420?: https://community.atlassian.com/forums/Training-Certification/Any-tips-for-ACP-420/td-p/2833293
- JSM professional cert (V2 release date): https://community.atlassian.com/forums/Training-Certification/JSM-professional-Cert/td-p/2958584
- Hean Tech study session notes:
  - https://community.atlassian.com/forums/Training-Certification-articles/Services-SLAs-Permission-ACP-420-Study-Session-4/ba-p/2962676
  - https://community.atlassian.com/forums/Jira-Service-Management-articles/JSM-Automations-and-ACP-420-study-session/ba-p/3002227
- YouTube playlist (19 videos): https://www.youtube.com/playlist?list=PL0qXSIEPa8o5GU0kiERYZqDRL5U_25o8Y
- Automation triggers, actions and limits: https://support.atlassian.com/cloud-automation/docs/jira-automation-triggers/
- SLA JQL functions: https://support.atlassian.com/jira-software-cloud/docs/jql-functions/
- Opsgenie escalations, routing and alert priorities: https://support.atlassian.com/opsgenie/docs/how-do-escalations-work-in-opsgenie/
