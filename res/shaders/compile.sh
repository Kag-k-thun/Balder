#! /bin/bash
# Compile the shaders of the engine next to their sources (x.frag gives x.frag.spv), the ones changed since their last
# compilation: the dev build, with the debug views and the outline of the editor (BALDER_DEBUG); the export of a game
# compiles the shaders it ships again without them (see ShaderBuild)

flags="-DBALDER_DEBUG"

# every shader is compiled again when the flags changed since the last run
stamp=".flags"
force=0
if [[ ! -f $stamp || "$(cat $stamp)" != "$flags" ]]; then
    force=1
fi

verts=$(find ./ | grep [.]vert$)
frags=$(find ./ | grep [.]frag$)
comps=$(find ./ | grep [.]comp$)

all="$verts $frags $comps"

for v in $all
do
    res="$v.spv"
    if [[ $force == 1 || ! -f $res || $v -nt $res ]]; then
        echo "[INFO] compile shader $v"
        glslc $flags $v -o $res || exit 1
    fi
done

echo "$flags" > $stamp
