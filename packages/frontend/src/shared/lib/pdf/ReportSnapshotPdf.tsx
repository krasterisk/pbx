import { Document, Font, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import { PDF_COLORS } from './pdfTheme';

const family = 'ReportSnapshotNoto';
Font.register({ family, fonts: [
  { src: `${import.meta.env.BASE_URL}fonts/noto-sans/NotoSans-Regular.ttf`, fontWeight:400 },
  { src: `${import.meta.env.BASE_URL}fonts/noto-sans/NotoSans-Bold.ttf`, fontWeight:700 },
] });
export interface ReportSnapshot {
  title: string; period: string; timezone: string; updatedAt: string; note?: string;
  metrics: Array<{label:string;value:string|number}>;
  buckets: Array<{label:string;total:number;human:number;robot:number;missed:number}>;
  legend: {total:string;human:string;robot:string;missed:string};
}
const style = StyleSheet.create({
  page:{fontFamily:family,fontSize:9,color:PDF_COLORS.text,padding:32,paddingBottom:48}, title:{fontSize:20,fontWeight:700,marginBottom:8},
  muted:{color:PDF_COLORS.muted,fontSize:8,marginBottom:5}, metrics:{flexDirection:'row',flexWrap:'wrap',marginVertical:16},
  metric:{width:'33.3%',padding:8}, value:{fontSize:20,fontWeight:700,color:PDF_COLORS.primary,marginTop:4},
  row:{position:'relative',width:531,height:32,borderBottomWidth:1,borderBottomColor:PDF_COLORS.border}, label:{position:'absolute',top:5,left:0,width:275}, cell:{position:'absolute',top:5,width:64,textAlign:'right'},
  bar:{height:5,backgroundColor:PDF_COLORS.primary,marginTop:3}, footer:{position:'absolute',bottom:16,left:32,right:32,fontSize:8,color:PDF_COLORS.muted},
});
export function ReportSnapshotDocument({ report }: {report:ReportSnapshot}) {
  const max = Math.max(1,...report.buckets.map(bucket=>bucket.total));
  return <Document title={report.title}><Page size="A4" style={style.page}>
    <Text style={style.footer} fixed render={({pageNumber,totalPages})=>`${report.updatedAt} · ${pageNumber}/${totalPages}`}/>
    <Text style={style.title}>{report.title}</Text><Text style={style.muted}>{report.period}</Text>
    {report.note && <Text style={style.muted}>{report.note}</Text>}
    <View style={style.metrics}>{report.metrics.map(metric=><View key={metric.label} style={style.metric}><Text>{metric.label}</Text><Text style={style.value}>{metric.value}</Text></View>)}</View>
    <View style={style.row} fixed><Text style={style.label}>{report.period}</Text>{(['total','human','robot','missed'] as const).map((key,index)=><Text key={key} style={[style.cell,{left:275+index*64}]}>{report.legend[key]}</Text>)}</View>
    {report.buckets.slice(0,400).map((bucket,index)=><View key={index} wrap={false} style={style.row}>
      <View style={style.label}><Text>{bucket.label}</Text><View style={[style.bar,{width:`${bucket.total/max*95}%`}]} /></View>
      {(['total','human','robot','missed'] as const).map((key,index)=><Text key={key} style={[style.cell,{left:275+index*64}]}>{bucket[key]}</Text>)}
    </View>)}
  </Page></Document>;
}
export async function generateReportSnapshotPdf(report: ReportSnapshot): Promise<Blob> {
  return pdf(<ReportSnapshotDocument report={report}/>).toBlob();
}
