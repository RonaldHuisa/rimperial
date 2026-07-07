import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import api from "../services/api";
import { renderInlineFormat, renderRichTextBlocks } from "../utils/richText";

function imageUrl(src) {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("data:")) return src;
  if (src.startsWith("/")) return src;
  return `/${src}`;
}

function renderSection(section, idx) {
  const key = section.id || idx;
  if (section.type === "heading") return <h2 key={key}>{renderInlineFormat(section.title || section.text, `heading-${key}`)}</h2>;
  if (section.type === "image") return <figure key={key}><img src={imageUrl(section.imageUrl)} alt={section.imageAlt || section.title || "Imagen"} />{section.text && <figcaption>{renderInlineFormat(section.text, `caption-${key}`)}</figcaption>}</figure>;
  if (section.type === "quote") return <blockquote key={key}>{renderInlineFormat(section.text, `quote-${key}`)}</blockquote>;
  return <React.Fragment key={key}>{renderRichTextBlocks(section.text, `section-${key}`)}</React.Fragment>;
}

export default function ArticleDetail() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.get(`/news/${slug}`).then((res) => setArticle(res.data.article)).catch((err) => setError(err.message));
  }, [slug]);
  if (error) return <div className="page-stack"><div className="alert error">{error}</div></div>;
  if (!article) return <div className="page-stack"><div className="panel-card"><p>Cargando artículo...</p></div></div>;
  return (
    <article className="article-page page-stack compact-article-page">
      <Link className="article-back-btn" to="/home"><FiArrowLeft /> <span>Volver al inicio</span></Link>
      <section className="article-hero compact-article-hero">
        <span className="eyebrow">Royal Imperial AI</span>
        <h1>{article.title}</h1>
        {article.summary && <p>{renderInlineFormat(article.summary, "article-summary")}</p>}
        {article.coverImageUrl && <img src={imageUrl(article.coverImageUrl)} alt={article.title} />}
      </section>
      <section className="article-content compact-article-content">
        {(article.sections || []).map(renderSection)}
      </section>
    </article>
  );
}
