/** Shown by "Use sample transcript" on the import page so the flow can be tried in one click. */
export const SAMPLE_TITLE = "Mobile Release Planning";

export const SAMPLE_TRANSCRIPT = `[00:00] Maya Chen: Okay, let's get started. The goal today is to decide what goes into the mobile 3.2 release and who owns what.
[00:14] Jordan Blake: Quick status first. The offline mode branch is merged, but QA found two crashes on older Android devices.
[00:31] Maya Chen: How bad are the crashes?
[00:36] Jordan Blake: About four percent of sessions on Android 10 and below. It's a memory spike when syncing more than five hundred items.
[00:55] Priti Nair: That's a release blocker for me. We have a lot of field users on older phones.
[01:07] Maya Chen: Agreed. Jordan, can you fix the sync memory issue before we cut the release candidate?
[01:16] Jordan Blake: Yes. I can batch the sync in chunks of fifty items. I'll have a fix in review by Thursday.
[01:34] Samir Haddad: On the design side, the new onboarding screens are ready. Three steps instead of six.
[01:47] Priti Nair: Great, because support keeps getting tickets from people who abandon setup at the permissions screen.
[02:01] Samir Haddad: I'd like to test it with five customers before we ship. Can we get a beta group?
[02:12] Maya Chen: Yes. Priti, can you line up five customers for Friday?
[02:20] Priti Nair: I'll reach out today and confirm by Wednesday.
[02:33] Maya Chen: Now the risky one. Push notifications. Marketing wants them in 3.2, but we haven't done the permission prompt research.
[02:48] Jordan Blake: Engineering effort is about two weeks, so it would push the release by a sprint.
[03:02] Samir Haddad: I'd rather not ship notifications without a good opt-in flow. Bad prompts hurt opt-in rates for months.
[03:15] Maya Chen: Then let's decide. Notifications move to 3.3. We ship offline mode and the new onboarding in 3.2.
[03:28] Priti Nair: Marketing won't love it, but I can explain it. I'll tell them today.
[03:40] Maya Chen: Thanks. What is our target date?
[03:46] Jordan Blake: If the crash fix lands Thursday, release candidate Monday, and store submission Wednesday the eighteenth.
[04:00] Samir Haddad: Does that leave time for the beta feedback?
[04:07] Priti Nair: Friday sessions, then a summary Monday morning. It should fit.
[04:19] Maya Chen: One open question. Do we need accessibility review on the new onboarding screens?
[04:29] Samir Haddad: Yes, and I haven't booked it. I'll ask the accessibility team for a slot this week.
[04:41] Maya Chen: Good. Let me recap. Offline mode and onboarding ship in 3.2, notifications slip to 3.3, Jordan fixes the crash by Thursday, Priti lines up beta customers, Samir books accessibility.
[04:58] Jordan Blake: Sounds right.
[05:03] Maya Chen: Thanks everyone.`;
