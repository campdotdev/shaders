// A repo-relative path rendered as a link that opens the file in VS Code.
// The vscode:// scheme needs an absolute path, which vite.config.ts injects
// as __REPO_ROOT__ at build time. That is the one reason this app is
// local-only by construction: the link means nothing on another machine.
export function FileLink({ path }: { path: string }) {
  return (
    <a className="file-link" href={`vscode://file${__REPO_ROOT__}/${path}`}>
      {path}
    </a>
  );
}
