export const FakeEditor = () => {
  return (
    <section className="editor-panel">
      <div className="line-numbers">
        <div>1</div>
        <div>2</div>
        <div>3</div>
        <div>4</div>
        <div>5</div>
      </div>

      <pre className="fake-editor">
        <code>{`select *
from users
where created_at >= now() - interval '7 days'
order by created_at desc
limit 100;`}</code>
      </pre>
    </section>
  );
};
