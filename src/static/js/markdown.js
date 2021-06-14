$(function(){
    
    $('.markdown a[href]').each(function(i, e){
        $(e).attr('target', '_blank');
    });
    
    $('.markdown code').each(function(i, e){
        var text = $(e).text();
        if (!text.match(/^(Command|Option)(\+\w+|\+.)*$/)) return;
        $(e).attr('title', text);
        text = text.replace(/\bCommand\b\+?/g, '<span class="mackey">&#8984;</span>')
            .replace(/\bOption\b\+?/g, '<span class="mackey">&#8997;</span>')
            .replace(/\bShift\b\+?/g, '<span class="mackey">&#8679;</span>');
        $(e).html(text);
    });
    
    $('.markdown table').each(function(i, e){
        var $table = $(e);
        $table.addClass('ui').addClass('table');
        
        var $th = $table.find('thead tr th:contains("@ace-class")');
        if ($th.length != 1) return;
        var i = $th.index();
        if (i < 0) return;
        $th.remove();
        $table.find('tbody tr td:nth-child(' + (i+1) + ')').each(function(i, e){
            var $td = $(e);
            var classes = $td.text()
                .split(/ +/)
                .map(function(c){ return 'ace_'+c; })
                .join(' ');
            var $tr = $td.parent();
            $td.remove();
            $tr.find('td code').each(function(i, e){
                var $code = $(e);
                $code.addClass('ace-flmml');
                $code.html('<span class="' + classes + '">' + $code.html() + '</span>');
            });
        });
    });
    
});
