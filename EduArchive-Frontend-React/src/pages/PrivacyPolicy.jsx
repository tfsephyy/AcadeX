import LegalPage from '../components/LegalPage'

export default function PrivacyPolicy() {
  return (
    <LegalPage eyebrow="Your information" title="Privacy Policy">
      <section>
        <h2>About this policy</h2>
        <p>AcadeX is a capstone repository for the Mindoro State University community. This policy explains what information the service handles, why it is used, and how you can make a privacy request. For questions, contact <a href="mailto:cuteiship@gmail.com">cuteiship@gmail.com</a>.</p>
      </section>

      <section>
        <h2>Information Acadex handles</h2>
        <ul>
          <li><strong>Account information:</strong> name, username, email address, institutional ID number where required, account role, and role-related academic details such as program, year, and section.</li>
          <li><strong>Google sign-in information:</strong> when you choose Google, Acadex receives and verifies the Google ID token, then uses your verified email, name, and Google account identifier to create or access your Acadex account. Acadex does not request access to Gmail, Drive, contacts, or other Google services.</li>
          <li><strong>Repository information:</strong> capstone titles, author and adviser details, abstracts, keywords, uploaded PDF files, review and approval information, and related notifications.</li>
          <li><strong>Security and service information:</strong> sign-in and verification events, account changes, audit records, and limited request or device information used to protect accounts, prevent abuse, and troubleshoot the service.</li>
          <li><strong>Browser storage:</strong> sign-in and security cookies, theme and reading preferences, and temporary upload recovery data. To resume after a reload, your selected PDF stays in this browser until transfer completes or you dismiss it or sign out. Pending citation-copy receipts may be retained until the service confirms them.</li>
        </ul>
      </section>

      <section>
        <h2>How information is used</h2>
        <p>Acadex uses this information to create and secure accounts, verify email or Google identity, apply account roles and approval rules, operate the research repository, review submissions, provide search and document access, send account and adviser notifications, and maintain service security.</p>
        <p>Uploaded PDFs may be processed to extract text and suggest metadata. Optical character recognition and optional AI-assisted organization may run on processing services configured for Acadex. These tools can make mistakes; people should review suggestions against the original PDF. The current sign-in flow uses Google only to verify identity and does not request unrelated Google account data.</p>
      </section>

      <section>
        <h2>Who can see information</h2>
        <p>Authorized administrators can manage accounts and repository records. Faculty and advisers can access work assigned to them according to their role. Capstones approved for repository publication, including their displayed metadata and document, may be visible to repository visitors. Submissions awaiting review and other restricted records are limited by the service's access controls.</p>
        <p>Acadex may use hosting, database, storage, email delivery, and background-processing providers to operate the service. They process information for those service purposes. Acadex does not sell personal information or use Google sign-in information for advertising. Information may also be disclosed when required by law or to protect the service and its users.</p>
      </section>

      <section>
        <h2>Storage, security, and retention</h2>
        <p>Acadex uses access controls and security measures intended to protect accounts and uploaded documents. Private PDF storage is encrypted by the application. Production hosting has been configured on cloud infrastructure in Sydney, Australia; service providers may process information in the locations where their systems operate.</p>
        <p>Account and security information is kept while needed to operate, secure, and administer the service, and for applicable legal or academic-record needs. Approved research may be retained in the repository for long-term academic access. When information is no longer needed, it should be securely deleted or de-identified in accordance with the applicable retention requirements.</p>
      </section>

      <section>
        <h2>Your choices and requests</h2>
        <p>You may ask to access or correct your personal information, raise an objection, or request deletion or restriction where applicable. Email <a href="mailto:cuteiship@gmail.com">cuteiship@gmail.com</a> and describe the account or record involved. Acadex may need to verify your identity and may retain academic repository or security records when required for legitimate service, institutional, or legal purposes.</p>
        <p>Please submit only documents and personal information that you are authorized to provide. If a capstone contains personal information about other people, make sure its collection and sharing are appropriate before uploading it.</p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>Acadex may update this policy when its practices change. The current version and its update date will be posted on this page. For material changes, the service may also provide notice through the application.</p>
      </section>
    </LegalPage>
  )
}
