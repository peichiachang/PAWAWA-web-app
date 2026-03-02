import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  CARE_KNOWLEDGE,
  CARE_LEVEL_LABEL,
  CareLevel,
  CareSection,
  DISEASE_ICON,
  DISEASE_LABEL,
  DiseaseFocus,
} from '../data/careKnowledge';
import { AppIcon } from './AppIcon';

const DISEASES: DiseaseFocus[] = ['general', 'kidney', 'diabetes', 'fiv', 'liver', 'fip'];
const LEVELS: CareLevel[] = ['basic', 'advanced', 'palliative'];

function SectionCard({ section }: { section: CareSection }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={ks.card}>
      <Pressable style={ks.cardHeader} onPress={() => setOpen((v) => !v)}>
        <Text style={ks.cardTitle}>{section.title}</Text>
        <Text style={ks.toggle}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open && (
        <View style={ks.cardBody}>
          {section.points.map((point, i) => (
            <View key={i} style={ks.pointRow}>
              <Text style={ks.bullet}>•</Text>
              <View style={ks.pointContent}>
                <Text style={ks.pointLabel}>{point.label}</Text>
                {point.sub?.map((sub, j) => (
                  <View key={j} style={ks.subRow}>
                    <Text style={ks.subBullet}>–</Text>
                    <Text style={ks.subText}>{sub}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export function KnowledgeContent() {
  const [disease, setDisease] = useState<DiseaseFocus>('general');
  const [level, setLevel] = useState<CareLevel>('basic');

  const sections = CARE_KNOWLEDGE[disease][level];

  function handleDiseaseChange(d: DiseaseFocus) {
    setDisease(d);
    setLevel('basic'); // 第一層切換時，第二層 tab 重置到第一個
  }

  const visibleLevels = LEVELS;

  return (
    <View>
      {/* Disease pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ks.pillScroll}>
        <View style={ks.pillRow}>
          {DISEASES.map((d) => (
            <Pressable
              key={d}
              style={[ks.pill, disease === d && ks.pillActive]}
              onPress={() => handleDiseaseChange(d)}
            >
              <AppIcon name={DISEASE_ICON[d] as any} size={18} color={disease === d ? '#ffffff' : '#000000'} style={ks.pillIcon} />
              <Text style={[ks.pillText, disease === d && ks.pillTextActive]}>
                {DISEASE_LABEL[d]}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Level tabs */}
      <View style={ks.levelTabs}>
        {visibleLevels.map((l) => (
          <Pressable
            key={l}
            style={[ks.levelTab, level === l && ks.levelTabActive]}
            onPress={() => setLevel(l)}
          >
            <Text style={[ks.levelTabText, level === l && ks.levelTabTextActive]}>
              {CARE_LEVEL_LABEL[l]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Section cards */}
      {sections.length === 0 ? (
        <View style={ks.emptyBox}>
          <Text style={ks.emptyText}>此分類目前無對應內容。</Text>
        </View>
      ) : (
        <View style={ks.sectionList}>
          {sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </View>
      )}
    </View>
  );
}

const ks = StyleSheet.create({
  pillScroll: {
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  pillActive: {
    backgroundColor: '#000000',
  },
  pillIcon: {
    fontSize: 14,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  levelTabs: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  levelTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  levelTabActive: {
    backgroundColor: '#000000',
  },
  levelTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  levelTabTextActive: {
    color: '#ffffff',
  },
  sectionList: {
    gap: 8,
  },
  emptyBox: {
    borderWidth: 2,
    borderColor: '#d4d4d4',
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#737373',
  },
  card: {
    borderWidth: 2,
    borderColor: '#000000',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    paddingRight: 8,
  },
  toggle: {
    fontSize: 18,
    fontWeight: '400',
    lineHeight: 20,
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    padding: 12,
    gap: 8,
  },
  pointRow: {
    flexDirection: 'row',
    gap: 6,
  },
  bullet: {
    fontSize: 13,
    marginTop: 1,
  },
  pointContent: {
    flex: 1,
    gap: 3,
  },
  pointLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  subRow: {
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 8,
  },
  subBullet: {
    fontSize: 12,
    color: '#525252',
    marginTop: 1,
  },
  subText: {
    flex: 1,
    fontSize: 12,
    color: '#404040',
    lineHeight: 17,
  },
});
