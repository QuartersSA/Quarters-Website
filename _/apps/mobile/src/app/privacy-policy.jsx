import { Pressable, ScrollView, Text, View, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { X, Shield, Globe, ExternalLink } from "lucide-react-native";

const PRIVACY_WEB_URL = "https://www.quarters.sa/privacy-policy";
const SUPPORT_WEB_URL = "https://www.quarters.sa/support";

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();

  const handleOpenWebVersion = async () => {
    try {
      await Linking.openURL(PRIVACY_WEB_URL);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenSupport = async () => {
    try {
      await Linking.openURL(SUPPORT_WEB_URL);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0B10" }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
            <X size={24} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <View
            style={{
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Shield size={20} color="#6EE7B7" />
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
              سياسة الخصوصية
            </Text>
          </View>
          <View style={{ width: 32 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 22,
            fontWeight: "900",
            textAlign: "right",
            marginBottom: 16,
          }}
        >
          سياسة الخصوصية
        </Text>

        <Text
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: 13,
            textAlign: "right",
            marginBottom: 20,
            lineHeight: 22,
          }}
        >
          آخر تحديث: {new Date().toLocaleDateString("ar-SA")}
        </Text>

        <Section
          title="البيانات التي نجمعها"
          content="نقوم بجمع البيانات التالية لتشغيل التطبيق:
• معلومات الموظف (الاسم، اسم المستخدم، الدور الوظيفي)
• معلومات الفرع المرتبط بالموظف
• رمز تسجيل الدخول (Token) للمصادقة
• بيانات المهام والجرد التي تقوم بإدخالها"
        />

        <Section
          title="كيف نستخدم بياناتك"
          content="نستخدم البيانات المجمعة للأغراض التالية:
• تسجيل الدخول والمصادقة
• عرض المهام والجرد الخاصة بك
• تمكينك من إدارة المهام والمخزون
• تحسين تجربة استخدام التطبيق"
        />

        <Section
          title="تخزين البيانات"
          content="يتم تخزين بيانات تسجيل الدخول بشكل آمن على جهازك باستخدام Expo Secure Store."
        />

        <Section
          title="مشاركة البيانات"
          content="يتم مشاركة بياناتك مع الأجزاء الداخلية من خدمة التطبيق فقط:
• خادم التطبيق الخاص بالشركة (جزء أساسي من الخدمة)
• واجهة الويب الداخلية (WebView) لعرض بعض الميزات
• يتم مشاركة رمز تسجيل الدخول ومعرف الموظف مع واجهة الويب للمصادقة وتمكين الميزات

هذه الأجزاء تُعتبر جزءاً لا يتجزأ من خدمة التطبيق وليست أطرافاً ثالثة خارجية. لن نشارك بياناتك مع أي جهات خارجية."
        />

        <Section
          title="حقوقك"
          content="لديك الحق في:
• الوصول إلى بياناتك الشخصية
• طلب تصحيح أو حذف بياناتك
• سحب موافقتك على جمع البيانات في أي وقت
• تسجيل الخروج وحذف البيانات المخزنة محلياً
• حذف حسابك وجميع البيانات المرتبطة به من خلال قسم الإعدادات"
        />

        <Section
          title="الأمان"
          content="نتخذ إجراءات أمنية معقولة لحماية بياناتك من الوصول غير المصرح به أو الكشف أو التعديل أو الإتلاف. يتم تشفير بيانات تسجيل الدخول وتخزينها بشكل آمن على جهازك."
        />

        <Section
          title="التغييرات على هذه السياسة"
          content="قد نقوم بتحديث سياسة الخصوصية من وقت لآخر. سيتم إخطارك بأي تغييرات جوهرية من خلال التطبيق."
        />

        <Section
          title="اتصل بنا"
          content="إذا كان لديك أي أسئلة حول سياسة الخصوصية هذه أو ترغب في حذف حسابك، يرجى التواصل معنا:

البريد الإلكتروني: Zalsaiari@quarters.sa
الموقع الإلكتروني: quarters.sa
صفحة الدعم: quarters.sa/support
أو من خلال قسم الإعدادات في التطبيق"
        />

        <Pressable
          onPress={handleOpenWebVersion}
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: 16,
            borderRadius: 16,
            backgroundColor: "rgba(110,231,183,0.08)",
            borderWidth: 1,
            borderColor: "rgba(110,231,183,0.15)",
            marginBottom: 12,
          }}
        >
          <Globe size={18} color="#6EE7B7" />
          <Text
            style={{
              color: "#6EE7B7",
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            عرض النسخة الكاملة على quarters.sa
          </Text>
          <ExternalLink size={14} color="#6EE7B7" />
        </Pressable>

        <Pressable
          onPress={handleOpenSupport}
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: 16,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.04)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            صفحة الدعم والمساعدة
          </Text>
          <ExternalLink size={14} color="rgba(255,255,255,0.5)" />
        </Pressable>

        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: "rgba(110,231,183,0.08)",
            borderWidth: 1,
            borderColor: "rgba(110,231,183,0.15)",
          }}
        >
          <Text
            style={{
              color: "#6EE7B7",
              fontSize: 13,
              textAlign: "right",
              lineHeight: 22,
            }}
          >
            باستخدامك لهذا التطبيق، فإنك توافق على سياسة الخصوصية هذه وعلى جمع
            واستخدام بياناتك كما هو موضح أعلاه.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, content }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          color: "#fff",
          fontSize: 16,
          fontWeight: "800",
          textAlign: "right",
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 14,
          textAlign: "right",
          lineHeight: 24,
        }}
      >
        {content}
      </Text>
    </View>
  );
}
