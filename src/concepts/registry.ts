export interface ConceptEntry {
  id: string;
  chapter: number;
  chapterTitle: string;
  title: string;
  status: 'hazir' | 'yakinda';
  href?: string;
}

const CH: Record<number, string> = {
  2: 'Keşifçi Veri Analizi (EDA) ve İstatistiksel Görselleştirme',
  3: 'Veri Ön İşleme: Eksik Veriler, Aykırı Değerler ve Dönüştürme',
  4: 'Özellik Mühendisliği ve Boyut İndirgeme',
  5: 'Sınıflandırmaya Giriş: Karar Ağaçları, k-NN ve Naive Bayes',
  6: 'Model Değerlendirme, Çapraz Doğrulama ve Metrikler',
  7: 'Kümeleme Analizi: K-Means, Hiyerarşik Kümeleme ve DBSCAN',
  8: 'Birliktelik Kuralı Madenciliği: Apriori ve FP-Growth',
  9: 'Topluluk Öğrenmesi (Ensemble): Bagging ve Random Forest',
  10: 'İleri Gradyan Artırma: XGBoost, LightGBM ve Optimizasyon',
  11: 'Dengesiz Veri Kümeleri ve Gerçek Dünya Veri Tuzakları',
  12: 'Metin Madenciliğine Giriş: TF-IDF ve Duygu Analizi',
  13: 'Açıklanabilir Yapay Zekâ ve Model Yorumlanabilirliği (XAI)',
};

function soon(id: string, chapter: number, title: string): ConceptEntry {
  return { id, chapter, chapterTitle: CH[chapter], title, status: 'yakinda' };
}

export const concepts: ConceptEntry[] = [
  {
    id: 'dagilim-carpiklik',
    chapter: 2,
    chapterTitle: CH[2],
    title: 'Dağılım, ortalama–medyan ve çarpıklık',
    status: 'hazir',
    href: 'dagilim-carpiklik/',
  },
  {
    id: 'normal-dagilim',
    chapter: 2,
    chapterTitle: CH[2],
    title: 'Normal dağılım ve standart sapma',
    status: 'hazir',
    href: 'normal-dagilim/',
  },
  {
    id: 'korelasyon-isi-haritasi',
    chapter: 2,
    chapterTitle: CH[2],
    title: 'Korelasyon, ısı haritası ve Anscombe Dörtlüsü',
    status: 'hazir',
    href: 'korelasyon-isi-haritasi/',
  },
  {
    id: 'kutu-grafigi',
    chapter: 2,
    chapterTitle: CH[2],
    title: 'Kutu grafiği: çeyrekler ve aykırı değerler',
    status: 'hazir',
    href: 'kutu-grafigi/',
  },
  {
    id: 'iqr-aykiri',
    chapter: 3,
    chapterTitle: CH[3],
    title: 'Eksik veri ve IQR ile aykırı değer',
    status: 'hazir',
    href: 'iqr-aykiri/',
  },
  { id: 'olcekleme', chapter: 3, chapterTitle: CH[3], title: 'Ölçekleme ve veri sızıntısı', status: 'hazir', href: 'olcekleme/' },
  { id: 'pca', chapter: 4, chapterTitle: CH[4], title: 'PCA ve t-SNE ile boyut indirgeme', status: 'hazir', href: 'pca/' },
  { id: 'ozellik-secimi', chapter: 4, chapterTitle: CH[4], title: 'Özellik seçimi: filtre ve sarmalayıcı', status: 'hazir', href: 'ozellik-secimi/' },
  {
    id: 'karar-agaci',
    chapter: 5,
    chapterTitle: CH[5],
    title: 'Karar ağacı (Gini/Entropi)',
    status: 'hazir',
    href: 'karar-agaci/',
  },
  {
    id: 'knn',
    chapter: 5,
    chapterTitle: CH[5],
    title: 'k-En Yakın Komşu (k-NN)',
    status: 'hazir',
    href: 'knn/',
  },
  {
    id: 'naive-bayes',
    chapter: 5,
    chapterTitle: CH[5],
    title: 'Naive Bayes',
    status: 'hazir',
    href: 'naive-bayes/',
  },
  { id: 'karmasiklik-matrisi', chapter: 6, chapterTitle: CH[6], title: 'Karmaşıklık matrisi ve metrikler', status: 'hazir', href: 'karmasiklik-matrisi/' },
  { id: 'roc-esik', chapter: 6, chapterTitle: CH[6], title: 'ROC, PR ve karar eşiği', status: 'hazir', href: 'roc-esik/' },
  { id: 'capraz-dogrulama', chapter: 6, chapterTitle: CH[6], title: 'Çapraz doğrulama ve veri sızıntısı', status: 'hazir', href: 'capraz-dogrulama/' },
  { id: 'k-means', chapter: 7, chapterTitle: CH[7], title: 'K-Means döngüsü', status: 'hazir', href: 'k-means/' },
  { id: 'k-secimi', chapter: 7, chapterTitle: CH[7], title: 'k sayısının seçimi', status: 'hazir', href: 'k-secimi/' },
  { id: 'dbscan', chapter: 7, chapterTitle: CH[7], title: 'DBSCAN', status: 'hazir', href: 'dbscan/' },
  { id: 'dendrogram', chapter: 7, chapterTitle: CH[7], title: 'Hiyerarşik kümeleme ve dendrogram', status: 'hazir', href: 'dendrogram/' },
  { id: 'birliktelik-olculeri', chapter: 8, chapterTitle: CH[8], title: 'Destek, güven ve kaldıraç', status: 'hazir', href: 'birliktelik-olculeri/' },
  { id: 'apriori', chapter: 8, chapterTitle: CH[8], title: 'Apriori ve FP-Growth', status: 'hazir', href: 'apriori/' },
  { id: 'bagging', chapter: 9, chapterTitle: CH[9], title: 'Bootstrap ve bagging', status: 'hazir', href: 'bagging/' },
  { id: 'random-forest', chapter: 9, chapterTitle: CH[9], title: 'Random Forest, OOB ve öznitelik önemi', status: 'hazir', href: 'random-forest/' },
  soon('boosting', 10, 'Boosting'),
  soon('smote', 11, 'SMOTE'),
  soon('tfidf-kosinus', 12, 'TF-IDF ve kosinüs benzerliği'),
  soon('shap', 13, 'SHAP'),
];
