import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Calendar } from "react-native-calendars";

import { Icon } from "@/src/components/icon";
import { Sheet } from "@/src/components/sheet";
import { makeStyles, useTheme } from "@/src/theme";
import { formatDateLong } from "@/src/utils/format";

/** Tap-to-pick date field. Stores/returns ISO "YYYY-MM-DD". Works on web + native. */
export function DatePickerField({
  value,
  onChange,
  placeholder = "Pilih tanggal",
  testID,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const todayIso = new Date().toISOString().slice(0, 10);
  const calTheme = {
    calendarBackground: colors.surfaceElevated,
    textSectionTitleColor: colors.muted,
    monthTextColor: colors.onSurface,
    dayTextColor: colors.onSurface,
    textDisabledColor: colors.borderStrong,
    todayTextColor: colors.brandPrimary,
    selectedDayBackgroundColor: colors.brandPrimary,
    selectedDayTextColor: colors.onBrandPrimary,
    arrowColor: colors.brandPrimary,
    textDayFontFamily: "DMSans",
    textMonthFontFamily: "Oswald",
    textDayHeaderFontFamily: "DMSans",
    textMonthFontSize: 18,
    textDayFontSize: 15,
  };

  return (
    <>
      <Pressable testID={testID} onPress={() => setOpen(true)} style={styles.field}>
        <Icon name="calendar" size={18} color={colors.brandPrimary} />
        <Text style={[styles.fieldText, !value && { color: colors.muted }]}>
          {value ? formatDateLong(value) : placeholder}
        </Text>
        <Icon name="caret-right" size={16} color={colors.muted} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Pilih Tanggal" testID="date-picker-sheet">
        <View style={styles.calWrap}>
          <Calendar
            testID="calendar"
            current={value || todayIso}
            onDayPress={(d: { dateString: string }) => {
              onChange(d.dateString);
              setOpen(false);
            }}
            markedDates={value ? { [value]: { selected: true } } : {}}
            enableSwipeMonths
            firstDay={1}
            theme={calTheme as any}
          />
        </View>
        <Pressable
          testID="date-today-button"
          onPress={() => {
            onChange(todayIso);
            setOpen(false);
          }}
          style={styles.todayBtn}
        >
          <Text style={styles.todayText}>Pilih tanggal hari ini</Text>
        </Pressable>
      </Sheet>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  fieldText: { flex: 1, color: colors.onSurface, fontFamily: "DMSans", fontSize: 15 },
  calWrap: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  todayBtn: { alignSelf: "center", paddingVertical: 12, marginTop: 4 },
  todayText: { color: colors.brandPrimary, fontFamily: "DMSans", fontSize: 14, fontWeight: "600" },
}));
