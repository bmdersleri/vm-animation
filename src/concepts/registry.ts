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
  soon('dagilim-carpiklik', 2, 'Dağılım ve çarpıklık'),
  soon('kutu-grafigi', 2, 'Kutu grafiği'),
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
  soon('ozellik-secimi', 4, 'Özellik seçimi: filtre ve sarmalayıcı'),
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
  soon('karmasiklik-matrisi', 6, 'Karmaşıklık matrisi'),
  soon('roc-esik', 6, 'ROC ve eşik'),
  soon('capraz-dogrulama', 6, 'Çapraz doğrulama'),
  soon('k-means', 7, 'K-Means'),
  soon('dbscan', 7, 'DBSCAN'),
  soon('dendrogram', 7, 'Dendrogram'),
  soon('apriori', 8, 'Apriori'),
  soon('bootstrap-rf', 9, 'Bootstrap ve Random Forest'),
  soon('boosting', 10, 'Boosting'),
  soon('smote', 11, 'SMOTE'),
  soon('tfidf-kosinus', 12, 'TF-IDF ve kosinüs benzerliği'),
  soon('shap', 13, 'SHAP'),
];
