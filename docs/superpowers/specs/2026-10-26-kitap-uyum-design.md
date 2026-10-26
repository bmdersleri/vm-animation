# Kitap v0.2 ile uyum — tasarım

## Amaç

Kitap (`C:\projects\ModernVeriMadenGiris`, dal `duzeltme/v0.2`) düzeltildi. Bazı
animasyon sayfaları kitabın eski ifadesine ya da eski sayısına dayanıyor. Bu iş,
sayfaları kitabın yeni hâliyle uyumlu hâle getirir. Yeni sayfa ya da yeni sahne
eklenmez.

## Kapsam

| # | Sayfa | Değişiklik |
|---|---|---|
| 1 | `gradyan-artirma` | 5. adımdaki elle düzeltme `[2, 0]` olamaz; kitap artık `[1, 1]` kullanıyor (sonuç `[2,1; 4,1]`). Veri betiği, veri, sahne metni ve testler buna göre güncellenir. |
| 2 | `birliktelik-olculeri` | Lift için "kaldıraç" kullanılmaz. Lift = "lift (ilgi oranı)", leverage = "kaldıraç". Sayfa başlığı "Destek, güven ve lift" olur (registry, sayfa metni, README listesi). |
| 3 | `iqr-aykiri` | Lab notu, Şekil 3.2'nin eski ifadesine dayanıyor; kitabın yeni ifadesine göre güncellenir. |
| 4 | `ozellik-secimi` | Son adımın örtüşme anlatımı ölçeklenmemiş RFE k=4'e dayanıyor. Kitap artık ölçekli RFE (Pipeline + StandardScaler) ve k=2 kullanıyor (`musteriKidemAy`, `destekTaleplerinSayisi`). Sayfa kitapla aynı sonuca getirilir ya da farkı "Kitapla farklar" kısmında açıkça yazar. |
| 5 | `bagging`, `random-forest` | Süreler (0,27 / 1,23 sn) "yaklaşık" diye yumuşatılır; kitap bir çalıştırmada 0,27 / 1,33 sn basıyor. |
| 6 | `dbscan` | Kitap artık sayfanın verisini kullanıyor (200 ay + 10 aykırı; 191 çekirdek / 8 sınır / 11 gürültü). "Kitapla farklar" notu ve spec buna göre güncellenir. |
| 7 | `dengesiz-veri`, `smote-sizinti` | Kitap artık test pozitif oranı farkını açıklıyor; "Kitapla farklar" kısmındaki bu madde kaldırılır. |
| 8 | `duygu-analizi` | İlk hata etiketi kitapla aynı olur: "niyet hatası (hata vermez)". Düzeltilmiş koddaki eski `# Çıktı:` düzyazı yorumu kitabın gerçek çıktısıyla değiştirilir. |
| 9 | `model-kaymasi` | Hata ayıklama kodundaki `HataAyiklama.python` → `.py`; düzyazı yorumlar `# Sonuç:` olur. |
| 10 | `lime-yerel` | 8. adımın tohum kararlılığı aralığı (spec 0,533–0,547 @5000) kitabın çalıştırmasıyla (11 tohum, 0,525–0,551) karşılaştırılır; fark tohum kümesindense sayfa kendi tohum kümesini metinde belirtir. |
| 11 | `AGENTS.md` | "Kitap salt okunur" kuralı: kitap 2026-10-25'te öğretmenin onayıyla bookMaker üzerinden düzeltildi; animasyon işi için kitap yine kaynak olarak okunur, düzenlenmez. |

## Kurallar

- `src/concepts/*/data/` elle düzenlenmez; `scripts/make_*_data.py` değiştirilip yeniden üretilir.
- Ekran görüntüsü taban çizgileri yalnızca metni değişen adımlarda yeniden alınır.
- Kitaptaki ilgili satır her maddede okunur; sayı ve ifade kitaptan alınır.

## Kabul

`npm run check` yeşil; her sayfa kitapla aynı sayıyı ve terimi kullanır ya da farkı
"Kitapla farklar" kısmında yazar.
