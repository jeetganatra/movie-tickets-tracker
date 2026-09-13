process.once("message", (row) => {
  if (row.id === "hang") {
    setInterval(() => {}, 1000);
  } else if (row.id === "fail") {
    process.exit(1);
  } else {
    process.send({ result: { tracker: row, bmsResult: { found: false, shows: [] }, districtResult: { found: false, shows: [] } } }, () => process.exit(0));
  }
});
