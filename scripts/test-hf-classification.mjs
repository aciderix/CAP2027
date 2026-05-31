#!/usr/bin/env node
// POC: zero-shot article classification via Hugging Face Inference API.
// Ne touche pas à la base de données (lecture seule). Affiche un tableau
// comparatif "tags actuels (keyword-matching)" vs "tags proposés par HF".
//
// Usage:
//   HF_TOKEN=hf_xxx node scripts/test-hf-classification.mjs
//
// Optionnel:
//   HF_MODEL=...                 (défaut: MoritzLaurer/mDeBERTa-v3-base-mnli-xnli)
//   MIN_SCORE=0.5                (défaut: seuil de retenue d'une catégorie)
//   MULTI_LABEL=true             (défaut: true, autorise plusieurs catégories par article)

import { createClient } from '@supabase/supabase-js';

const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) {
  console.error('❌ HF_TOKEN manquant. Lance avec: HF_TOKEN=hf_xxx node scripts/test-hf-classification.mjs');
  process.exit(1);
}

const HF_MODEL = process.env.HF_MODEL ?? 'MoritzLaurer/mDeBERTa-v3-base-mnli-xnli';
const MIN_SCORE = Number(process.env.MIN_SCORE ?? '0.5');
const MULTI_LABEL = (process.env.MULTI_LABEL ?? 'true') === 'true';

const SUPABASE_URL = 'https://oyvqvfawcxlnvpgloicx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nycw__S1NdZYIVyu4LH4SQ_830IdXPA';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 16 catégories cibles (= les noms d'étiquettes que HF doit choisir).
// Le contenu sémantique compte plus que la liste exacte de keywords.
const CATEGORIES = [
  'Écologie',
  'Économie',
  'Social',
  'Santé',
  'Sécurité',
  'Éducation',
  'Europe',
  'Justice',
  'Immigration',
  'Institutions & Politique',
  'International',
  'Technologie & Numérique',
  'Culture & Loisirs',
  'Sport',
  'Transports & Mobilité',
  'Faits Divers',
];

// Articles de test : mix de cas connus (faux positifs identifiés, articles
// actuellement orphelins, articles correctement tagués pour vérifier qu'on
// ne casse pas l'existant).
const TEST_TITLES = [
  'La Russie transfère des ogives nucléaires au Bélarus sur fond de tensions croissantes avec l’OTAN',
  'Sacre du PSG : du Royaume-Uni aux Pays-Bas, les nationalistes épinglent le chaos en France',
  'Mayotte : l\'inquiétude face au virus Ebola',
  'Pesticides, microplastiques, OGM... De quoi les Européens ont-ils peur dans leur assiette ?',
  'Sébastien Bazin, PDG du groupe Accor : «C\'est devenu le leader incontesté sur tous les continents»',
  'Quand la gauche plombe les travailleurs',
  'Roland Garros : Naomi Osaka et le dîner qui dérange',
  'Au Japon, la grande réorganisation des services de renseignement a commencé',
  'Maintien par Canal + d’une chroniqueuse pro-russe : «Il faut retirer le micro» à Fedorova, estime Glucksmann',
  '« Mon âme est née ici » : Jean-Louis Aubert donne un concert pour sauver l’église de son enfance',
];

async function fetchArticles() {
  const { data, error } = await supabase
    .from('news_articles')
    .select(`
      id, title, summary,
      article_themes ( score, theme:themes (name) )
    `)
    .in('title', TEST_TITLES);
  if (error) throw error;
  return data ?? [];
}

async function classify(text) {
  const start = Date.now();
  const res = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: text.slice(0, 1500), // tronquer pour rester dans les limites du modèle
      parameters: {
        candidate_labels: CATEGORIES,
        multi_label: MULTI_LABEL,
      },
      options: { wait_for_model: true },
    }),
  });
  const latency = Date.now() - start;
  if (!res.ok) {
    const body = await res.text();
    return { error: `HTTP ${res.status}: ${body.slice(0, 200)}`, latency };
  }
  const json = await res.json();
  return { ...json, latency };
}

function formatCurrentTags(article) {
  const tags = article.article_themes ?? [];
  if (!tags.length) return '(aucun)';
  return tags
    .map((t) => `${t.theme?.name ?? '?'}(${t.score})`)
    .sort()
    .join(', ');
}

function formatHFResult(result) {
  if (result.error) return `❌ ${result.error}`;
  const pairs = result.labels.map((l, i) => ({ label: l, score: result.scores[i] }));
  const kept = pairs.filter((p) => p.score >= MIN_SCORE);
  if (!kept.length) {
    const top = pairs[0];
    return `(rien ≥ ${MIN_SCORE}) — top: ${top.label} (${top.score.toFixed(2)})`;
  }
  return kept.map((p) => `${p.label} (${p.score.toFixed(2)})`).join(', ');
}

async function main() {
  console.log(`🤖 Modèle HF: ${HF_MODEL}`);
  console.log(`📊 Seuil minimum: ${MIN_SCORE}, multi-label: ${MULTI_LABEL}\n`);

  const articles = await fetchArticles();
  console.log(`📰 ${articles.length} articles à tester\n`);
  console.log('─'.repeat(120));

  let totalLatency = 0;
  let errors = 0;
  for (const a of articles) {
    const text = `${a.title}\n\n${a.summary ?? ''}`;
    const result = await classify(text);
    totalLatency += result.latency ?? 0;
    if (result.error) errors++;

    console.log(`\n📌 ${a.title.slice(0, 100)}${a.title.length > 100 ? '…' : ''}`);
    console.log(`   ⏱  ${result.latency}ms`);
    console.log(`   📋 Actuel  : ${formatCurrentTags(a)}`);
    console.log(`   🤖 HF      : ${formatHFResult(result)}`);
  }

  console.log('\n' + '─'.repeat(120));
  console.log(`\n📈 Bilan: ${articles.length - errors}/${articles.length} OK · ` +
              `latence moyenne ${Math.round(totalLatency / articles.length)}ms`);
}

main().catch((e) => {
  console.error('💥 Erreur fatale:', e);
  process.exit(1);
});
