async function main() {
  const res = await fetch("https://wandbox.org/api/compile.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      compiler: "python-cpython-3.10.8",
      code: "print(input())\nprint(input())",
      stdin: "hello\nworld"
    })
  });
  console.log(await res.json());
}
main();
