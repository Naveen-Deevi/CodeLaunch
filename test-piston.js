async function main() {
  const res = await fetch("https://emkc.org/api/v2/piston/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: "python",
      version: "*",
      files: [{ content: "print(input())\nprint(input())" }],
      stdin: "hello\nworld"
    })
  });
  console.log(await res.json());
}
main();
