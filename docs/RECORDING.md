# Record the working Tabby extension

The ready browser uses the actual extension and live DeepSeek. The landing page's web preview has separate data and cannot manage Chrome tabs.

The current demo is already open in **Chrome for Testing**, with React documentation and Keyboard Cat. The local AI server is running. To start it again later, run `npm run server` if port 4318 is not already in use, then `npm run demo -- --ready --web` in another terminal. Do not start two demos with the same profile.

1. Keep the React tab active. In Tabby's **Settings**, use **Allow access to current site** and approve Chrome's prompt. Repeat on YouTube. This enables visible text and in-page reminders for those sites; title/URL assessment alone does not require this permission.
2. Return to React. In **Focus**, enter **Build a React login form** and click **Start focusing**. An existing paused session instead shows **Resume**.
3. Keep that browser window active. Tabby waits about eight seconds, then calls DeepSeek. Wait for **On track**. A model response can take additional seconds.
4. Switch to the YouTube tab. Wait for **Possible distraction**, then click **Back to work** in the Tabby side panel. The original React tab becomes active.
5. On React, open **Tasks → From page**. Review the generated title, steps and source, then click **Save task**.
6. Open **Tabs → Suggest groups**. Review the proposal and click **Confirm & create groups**. The groups are real Chrome groups.

Focus also shows **Allow access to this site** whenever the current page lacks host permission. Changing to another application or leaving the computer idle puts the session in **Away**; return to Chrome before continuing the demonstration. Pausing cancels pending page analysis.

Google Calendar/Gmail require a Google OAuth client and account connection. Outbound Ambiguous requires its own authorization. The working task/project in the Ambiguous website is a separate workflow. These account integrations are not automatically connected by starting this demo.

An English narration stem is available at `public/demo/tabby-narration-en.mp3` if useful for editing your own footage.
