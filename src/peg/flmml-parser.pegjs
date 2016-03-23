{

  function exceptNull(a) {
    return a.filter(function(r){ return r!=null; });
  }

  function unroll(first, rest, index) {
    var ret = rest ? rest.map(function(r){ return index==null ? r : r ? r[index] : null; }) : [];
    if (first!=null) ret.unshift(first);
    return exceptNull(ret);
  }

  function loc() {
    var l = location();
    return [ l.start.offset, l.end.offset ];
  }

  function trim(str) {
    return str.replace(/^\s+|\s+$/g, '');
  }

}

start = MML

MML
  = parts:Line* {
    return unroll(null, parts);
  }

Line
  = BlankLine
  / MetaLine
  / MacroDef
  / TrackDef
  / SPC

BlankLine
  = _? EOL {
      return null;
    }

MetaLine
  = MetaLine_Info
  / MetaLine_WAV9
  / MetaLine_WAV13
  / MetaLine_Others

MetaLine_Info
  = "#" header:( "TITLE"i / "ARTIST"i / "COMMENT"i / "CODING"i ) _ data:ANY EOL {
    return { type:"meta", name:"info", location:loc(), value:{
      header: header.toLowerCase(),
      data: trim(data)
    }};
  }

MetaLine_WAV9
  = "#WAV9"i _ id:INTNUM Comma start:INTNUM Comma loop:INTNUM Comma data:BASE64 _? EOL {
    return { type:"meta", name:"WAV9", location:loc(), value:{
      id: parseInt(id),
      start: parseInt(start),
      loop: parseInt(loop),
      data: data
    }};
  }

MetaLine_WAV13
  = "#WAV13"i _ id:INTNUM Comma data:HexArray _? EOL {
    return { type:"meta", name:"WAV13", location:loc(), value:{
      id: parseInt(id),
      data: data
    }};
  }

MetaLine_Others
  = "#" name:IDENT meta:ANY? EOL {
        return { type:"meta", name:name, location:loc(), value:meta };
    }

MacroDef
  = "$" name:IDENT _? params:MacroParams? _? "=" _? body:MacroBody {
        return { type:"macrodef", location:loc(), name:name, params:params, body:body };
    }

MacroParams
  = "{" _ ? first:IDENT rest:( Comma IDENT )* _? "}" {
      return unroll(first, rest, 1);
    }

MacroBody
  = entities:Entities ";" {
      return entities;
    }

TrackDef
  = entities:Entities ";"? {
      return { type:"trackdef", location:loc(), body:entities };
    }

Entities
  = $( [^;]+ )

HexArray
  = first:HEX rest:( _ HEX )* {
      return unroll(first, rest, 1).map(function(h){ return parseInt(h, 16); });
    }

Comma
  = _? "," _?

_ = [ \t]+
SPC = [\s]+
EOL = [\r\n]+
ANY = $( [^\r\n]+ )
IDENT = $( [a-zA-Z_][a-zA-Z_0-9#\+\(\)]* )
INTNUM = $( [0-9]+ )
BASE64 = $( [0-9a-zA-Z\+\/\=]+ )
HEX = $( [0-9a-fA-F]+ )
